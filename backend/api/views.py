import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .label_analyzer.ocr_engine import analyze_label_image
from .label_analyzer.validator import validate_extraction_completeness
from .label_analyzer.matching import evaluate_compatibility

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
    completeness checks, and deterministic restriction evaluation.
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

        try:
            image_bytes = image_file.read()
            report = analyze_label_image(
                image_bytes=image_bytes,
                file_name=image_file.name,
                user_restrictions=restrictions,
                user_targets=targets,
                client_supplied_text=client_text,
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
    allergen, or nutrition fields, and re-evaluates compatibility findings.
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
        findings = evaluate_compatibility(
            ingredients=ingredients,
            allergen_statements=allergen_statements,
            nutrition_facts=nutrition_facts,
            user_restrictions=restrictions,
            user_targets=targets,
            quality_tier=quality_tier,
            is_complete=completeness["is_complete"]
        )

        return Response({
            "status": "verified",
            "is_complete": completeness["is_complete"],
            "completeness_score": completeness["completeness_score"],
            "uncertainty_flags": completeness["uncertainty_flags"],
            "ingredients": ingredients,
            "allergen_statements": allergen_statements,
            "nutrition_facts": nutrition_facts,
            "findings": findings,
            "manual_confirmation_needed": False,
        }, status=status.HTTP_200_OK)
