import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token

from .models import UserProfile
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserDetailSerializer,
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

