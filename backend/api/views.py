import json
from datetime import datetime, date
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token

from .models import UserProfile, ConsumptionRecord
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserDetailSerializer,
    ConsumptionRecordSerializer,
    CreateConsumptionRecordSerializer,
)
from .nutrition.reference_limits import (
    REFERENCE_LIMITS,
    REFERENCE_SYSTEM_NAME,
    REFERENCE_SYSTEM_DISPLAY,
)
from .nutrition.calculator import (
    calculate_product_contribution,
    accumulate_daily_intake,
)
from .label_analyzer.ocr_engine import analyze_label_image
from .label_analyzer.validator import validate_extraction_completeness
from .label_analyzer.matching import evaluate_compatibility
from .label_analyzer.contradiction import detect_contradictions, identify_ambiguous_ingredients

class HealthCheckView(APIView):
    """
    Health check endpoint for Unpack backend.
    Validates server responsiveness and provides basic service metadata.
    """
    permission_classes = []

    def get(self, request, *args, **kwargs):
        return Response({
            "status": "healthy",
            "app": "Unpack",
            "tagline": "Know What's Inside.",
            "version": "1.0.0",
            "environment": "development"
        }, status=status.HTTP_200_OK)

class AnalyzeLabelView(APIView):
    """
    Analyzes an uploaded packaged food label image.
    Performs image-quality assessment, OCR extraction with uncertainty flags,
    completeness checks, contradiction detection, and deterministic restriction evaluation.
    """
    permission_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No image file provided. Please upload an image with key 'image'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (< 10MB)
        if image_file.size > 10 * 1024 * 1024:
            return Response(
                {"error": "Image file exceeds 10MB limit. Please upload a smaller image."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse user restrictions and targets if provided in request
        restrictions_param = request.data.get("restrictions", [])
        if isinstance(restrictions_param, str):
            try:
                restrictions = json.loads(restrictions_param)
            except Exception:
                restrictions = [r.strip() for r in restrictions_param.split(",") if r.strip()]
        else:
            restrictions = list(restrictions_param)

        targets_param = request.data.get("targets", {})
        if isinstance(targets_param, str):
            try:
                targets = json.loads(targets_param)
            except Exception:
                targets = {}
        else:
            targets = dict(targets_param)

        client_text = request.data.get("raw_text", "")

        ai_interp_param = request.data.get("ai_interpretation", {})
        if isinstance(ai_interp_param, str):
            try:
                ai_interpretation = json.loads(ai_interp_param)
            except Exception:
                ai_interpretation = {}
        elif isinstance(ai_interp_param, dict):
            ai_interpretation = ai_interp_param
        else:
            ai_interpretation = {}

        try:
            image_bytes = image_file.read()
            report = analyze_label_image(
                image_bytes=image_bytes,
                file_name=image_file.name,
                user_restrictions=restrictions,
                user_targets=targets,
                client_supplied_text=client_text,
                ai_interpretation=ai_interpretation,
            )
            return Response(report, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {
                    "error": f"Failed to analyze image: {str(exc)}",
                    "readability_status": "ERROR",
                    "uncertainty_flags": ["Server encountered an error while decoding image."],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VerifyFieldsView(APIView):
    """
    Allows users to manually correct, edit, or confirm extracted ingredient,
    allergen, or nutrition fields, and re-evaluates compatibility findings and contradictions.
    """
    permission_classes = []
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        ingredients = request.data.get("ingredients", [])
        allergen_statements = request.data.get("allergen_statements", [])
        nutrition_facts = request.data.get("nutrition_facts", {})
        restrictions = request.data.get("restrictions", [])
        targets = request.data.get("targets", {})
        raw_text = request.data.get("raw_text", "")
        quality_tier = request.data.get("quality_tier", "CLEAR")

        completeness = validate_extraction_completeness(raw_text, ingredients, nutrition_facts, quality_tier)

        contradictions = detect_contradictions(
            raw_text=raw_text,
            ingredients=ingredients,
            allergen_statements=allergen_statements,
            nutrition_facts=nutrition_facts,
            quality_tier=quality_tier
        )
        ambiguous_ingredients = identify_ambiguous_ingredients(ingredients)

        findings = evaluate_compatibility(
            ingredients=ingredients,
            allergen_statements=allergen_statements,
            nutrition_facts=nutrition_facts,
            user_restrictions=restrictions,
            user_targets=targets,
            quality_tier=quality_tier,
            is_complete=completeness["is_complete"],
            contradictions=contradictions,
            raw_text=raw_text,
        )

        uncertainty_flags = list(completeness["uncertainty_flags"])
        for c in contradictions:
            uncertainty_flags.append(f"Contradiction Alert: {c.get('explanation')}")

        return Response({
            "status": "verified",
            "is_complete": completeness["is_complete"],
            "completeness_score": completeness["completeness_score"],
            "uncertainty_flags": uncertainty_flags,
            "ingredients": ingredients,
            "allergen_statements": allergen_statements,
            "nutrition_facts": nutrition_facts,
            "findings": findings,
            "contradictions": contradictions,
            "ambiguous_ingredients": ambiguous_ingredients,
            "manual_confirmation_needed": bool(contradictions) or any(f.get("requires_manual_confirmation") for f in findings),
        }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    Registers a new user and returns their authentication token and profile.
    """
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors, "message": "Registration failed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        user_data = UserDetailSerializer(user).data

        return Response({
            "token": token.key,
            "user": user_data,
            "message": "Account created successfully."
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Authenticates an existing user and returns their auth token and profile.
    """
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors, "message": "Invalid email or password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        user_data = UserDetailSerializer(user).data

        return Response({
            "token": token.key,
            "user": user_data,
            "message": "Logged in successfully."
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Logs out the authenticated user by invalidating their token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            if hasattr(request.user, 'auth_token'):
                request.user.auth_token.delete()
        except Exception:
            pass
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    Returns the currently authenticated user's details and profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """
    Retrieves or updates the authenticated user's dietary profile and onboarding status.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request, *args, **kwargs):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors, "message": "Failed to update profile."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save()
        return Response({
            "profile": serializer.data,
            "message": "Profile updated successfully."
        }, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        return self.put(request, *args, **kwargs)


class ReferenceLimitsView(APIView):
    """
    Returns the centralized daily reference limits and standards (FSSAI 2020 / ICMR 2020).
    Provides display names, benchmark amounts, units, alert thresholds, and legal disclaimers.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        limits_data = {
            k: ref.to_dict() for k, ref in REFERENCE_LIMITS.items()
        }
        return Response({
            "reference_system": REFERENCE_SYSTEM_NAME,
            "reference_system_display": REFERENCE_SYSTEM_DISPLAY,
            "disclaimer": (
                "Reference benchmarks are based on FSSAI (Labelling and Display) Regulations 2020 "
                "and ICMR-NIN 2020 Dietary Guidelines for Indians (2,000 kcal diet). "
                "These general educational references do not constitute individualized medical or clinical advice."
            ),
            "limits": limits_data,
        }, status=status.HTTP_200_OK)


class ConsumptionRecordListView(APIView):
    """
    Confirmed consumption records endpoint.
    - POST: Explicit confirmation and persistence of a consumed food item.
    - GET: Retrieves confirmed records for a specific date (or date range) for the authenticated user.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        serializer = CreateConsumptionRecordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors, "message": "Invalid consumption submission."},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        user = request.user
        scan_id = data.get("scan_id", "").strip()
        idempotency_key = data.get("idempotency_key", "").strip() or scan_id

        # Idempotency / duplicate protection check
        if idempotency_key:
            existing = ConsumptionRecord.objects.filter(
                user=user,
                scan_id=idempotency_key,
            ).first()
            if existing:
                # Return existing record to avoid duplicate consumption logging
                rec_serializer = ConsumptionRecordSerializer(existing)
                return Response({
                    "record": rec_serializer.data,
                    "message": "Consumption record already confirmed.",
                    "is_duplicate": True,
                }, status=status.HTTP_200_OK)

        servings = data["servings_consumed"]
        basis_used = data.get("basis_used", "per_serving")
        raw_facts = data.get("nutrition_facts", {})
        product_name = data.get("product_name", "Scanned Food Product").strip() or "Scanned Food Product"
        serving_size = data.get("serving_size", "").strip()
        serving_unit = data.get("serving_unit", "serving").strip() or "serving"
        notes = data.get("notes", "").strip()

        # Parse target consumption date
        consumption_date = data.get("consumption_date")
        if not consumption_date:
            consumption_date = timezone.localdate()

        # Authoritatively calculate exact nutrient contributions on the backend
        contributions = calculate_product_contribution(
            nutrition_facts=raw_facts,
            servings_consumed=servings,
            basis_used=basis_used,
            serving_size=serving_size,
            serving_unit=serving_unit,
        )

        try:
            record = ConsumptionRecord.objects.create(
                user=user,
                product_name=product_name,
                scan_id=idempotency_key,
                servings_consumed=servings,
                serving_size=serving_size,
                serving_unit=serving_unit,
                basis_used=basis_used,
                consumption_date=consumption_date,
                nutrients_snapshot=contributions,
                reference_system=REFERENCE_SYSTEM_NAME,
                notes=notes,
            )
        except Exception as e:
            return Response(
                {"error": f"Database failure saving consumption record: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        rec_serializer = ConsumptionRecordSerializer(record)
        return Response({
            "record": rec_serializer.data,
            "message": f"Successfully recorded consumption of {product_name} ({servings} serving{'s' if servings != 1 else ''}).",
            "is_duplicate": False,
        }, status=status.HTTP_201_CREATED)

    def get(self, request, *args, **kwargs):
        date_str = request.query_params.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = timezone.localdate()

        records = ConsumptionRecord.objects.filter(
            user=request.user,
            consumption_date=target_date,
        ).order_by("-consumption_time")

        serializer = ConsumptionRecordSerializer(records, many=True)
        return Response({
            "date": str(target_date),
            "count": records.count(),
            "records": serializer.data,
        }, status=status.HTTP_200_OK)


class ConsumptionRecordDetailView(APIView):
    """
    Retrieve, edit, or delete a confirmed consumption record.
    Guarantees user scoping: users can never read, modify, or delete another user's records.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request, pk, *args, **kwargs):
        record = get_object_or_404(ConsumptionRecord, pk=pk, user=request.user)
        serializer = ConsumptionRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk, *args, **kwargs):
        record = get_object_or_404(ConsumptionRecord, pk=pk, user=request.user)

        new_servings = request.data.get("servings_consumed")
        new_notes = request.data.get("notes")
        new_product_name = request.data.get("product_name")

        if new_servings is not None:
            try:
                servings_float = float(new_servings)
                if servings_float <= 0:
                    return Response(
                        {"error": "Servings consumed must be greater than zero."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid servings quantity format."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Recalculate nutrient contributions with the new serving multiplier
            old_snapshot = record.nutrients_snapshot or {}
            updated_snapshot = {}
            for k, item in old_snapshot.items():
                base_val = item.get("base_amount")
                is_missing = item.get("is_missing", False)
                unit = item.get("unit", "")
                if not is_missing and base_val is not None:
                    new_amt = round(float(base_val) * servings_float, 2)
                    updated_snapshot[k] = {
                        **item,
                        "amount": new_amt,
                        "servings_multiplier": servings_float,
                    }
                else:
                    updated_snapshot[k] = {
                        **item,
                        "amount": None,
                        "servings_multiplier": servings_float,
                    }

            record.servings_consumed = servings_float
            record.nutrients_snapshot = updated_snapshot

        if new_notes is not None:
            record.notes = str(new_notes).strip()
        if new_product_name is not None and str(new_product_name).strip():
            record.product_name = str(new_product_name).strip()

        record.save()
        serializer = ConsumptionRecordSerializer(record)
        return Response({
            "record": serializer.data,
            "message": "Consumption record updated successfully.",
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk, *args, **kwargs):
        record = get_object_or_404(ConsumptionRecord, pk=pk, user=request.user)
        product_name = record.product_name
        record.delete()
        return Response({
            "message": f"Deleted consumption record for '{product_name}'.",
        }, status=status.HTTP_200_OK)


class DailyIntakeSummaryView(APIView):
    """
    Computes daily accumulated nutritional ledger and multi-product alerts for a given local date.
    Recalculates totals immediately from confirmed records.
    Never coerces missing data to zero; warns when data is incomplete.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        date_str = request.query_params.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = timezone.localdate()

        date_key = str(target_date)

        records = ConsumptionRecord.objects.filter(
            user=request.user,
            consumption_date=target_date,
        ).order_by("-consumption_time")

        records_payload = [
            {
                "id": r.id,
                "product_name": r.product_name,
                "servings_consumed": r.servings_consumed,
                "serving_size": r.serving_size,
                "serving_unit": r.serving_unit,
                "basis_used": r.basis_used,
                "consumption_time": r.consumption_time.isoformat() if r.consumption_time else None,
                "nutrients_snapshot": r.nutrients_snapshot or {},
            }
            for r in records
        ]

        summary = accumulate_daily_intake(records_payload, date_key)
        return Response(summary, status=status.HTTP_200_OK)


class IntakeHistoryDatesView(APIView):
    """
    Returns dates for which the user has logged consumption, useful for historical navigation.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        records = (
            ConsumptionRecord.objects.filter(user=request.user)
            .values_list("consumption_date", flat=True)
            .distinct()
            .order_by("-consumption_date")
        )
        dates_list = [str(d) for d in records]
        return Response({
            "dates": dates_list,
            "total_logged_days": len(dates_list),
        }, status=status.HTTP_200_OK)

