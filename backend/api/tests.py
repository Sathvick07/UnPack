import io
import json
from PIL import Image, ImageDraw
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .label_analyzer.quality import assess_image_quality
from .label_analyzer.matching import evaluate_compatibility

def create_dummy_image(width=600, height=600, color=(240, 240, 240)):
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    # Add contrast detail
    draw.rectangle([50, 50, width - 50, height - 50], outline=(20, 20, 20), width=4)
    draw.text((80, 80), "INGREDIENTS: Oats, Almonds, Salt.", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

class HealthCheckEndpointTests(APITestCase):
    def test_health_check_returns_200_and_expected_payload(self):
        url = reverse('health-check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("app"), "Unpack")
        self.assertEqual(data.get("tagline"), "Know What's Inside.")
        self.assertEqual(data.get("version"), "1.0.0")

class ImageQualityAssessmentTests(APITestCase):
    def test_clear_standard_image_passes_quality(self):
        img_bytes = create_dummy_image(width=800, height=600)
        result = assess_image_quality(img_bytes, "clear_label.jpg")
        self.assertTrue(result["is_valid"])
        self.assertIn(result["quality_tier"], ["CLEAR", "MODERATE"])
        self.assertGreaterEqual(result["quality_score"], 70)

    def test_low_resolution_produces_warning(self):
        # Image smaller than 350px
        img_bytes = create_dummy_image(width=150, height=150)
        result = assess_image_quality(img_bytes, "tiny_label.jpg")
        self.assertTrue(result["is_valid"])
        self.assertIn(result["quality_tier"], ["LOW", "UNREADABLE", "UNCERTAIN"])
        self.assertTrue(any("resolution" in w.lower() for w in result["warnings"]))

    def test_extreme_aspect_ratio_produces_warning(self):
        # Aspect ratio > 3.8
        img_bytes = create_dummy_image(width=1200, height=200)
        result = assess_image_quality(img_bytes, "cropped_strip.jpg")
        self.assertTrue(any("aspect ratio" in w.lower() for w in result["warnings"]))

class AnalyzeLabelEndpointTests(APITestCase):
    def setUp(self):
        self.analyze_url = reverse('analyze-label')

    def test_missing_image_returns_400(self):
        response = self.client.post(self.analyze_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.json())

    def test_clear_label_with_allergen_conflict_detected(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")
        
        # Test label with peanut allergen
        peanut_label_text = (
            "INGREDIENTS: Roasted peanuts, sugar, vegetable oil, salt.\n"
            "CONTAINS: Peanuts.\n"
            "NUTRITION FACTS (per 100g):\n"
            "Energy: 560 kcal\n"
            "Fat: 50 g\n"
            "Protein: 25 g\n"
            "Sodium: 400 mg"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut"]),
                "raw_text": peanut_label_text,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["readability_status"], "CLEAR")
        
        findings = data["findings"]
        conflict_findings = [f for f in findings if f["status"] == "CONFLICT DETECTED"]
        self.assertEqual(len(conflict_findings), 1)
        self.assertEqual(conflict_findings[0]["restriction"], "peanut")
        self.assertIn("peanut", conflict_findings[0]["evidence"].lower())

    def test_no_allergen_produces_negative_confirmation_not_guarantee(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")
        
        safe_label_text = (
            "INGREDIENTS: Rolled oats, honey, cinnamon, sea salt.\n"
            "NUTRITION FACTS (per 100g):\n"
            "Energy: 380 kcal\n"
            "Protein: 10 g\n"
            "Sodium: 120 mg"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut", "shellfish"]),
                "raw_text": safe_label_text,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        findings = data["findings"]
        
        for f in findings:
            if f.get("restriction") in ["peanut", "shellfish"]:
                self.assertEqual(f["status"], "NO CONFLICT IDENTIFIED IN READABLE INFORMATION")
                # Must contain the safety disclaimer!
                self.assertIn("does not guarantee", f["explanation"])

    def test_unclear_or_incomplete_label_produces_unknown_verify(self):
        # Create an unreadable tiny image
        img_bytes = create_dummy_image(width=100, height=100)
        image_file = SimpleUploadedFile("blurry.jpg", img_bytes, content_type="image/jpeg")

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # When quality is unreadable, status must NOT claim peanut-free!
        self.assertEqual(data["readability_status"], "UNREADABLE")
        findings = data["findings"]
        peanut_finding = [f for f in findings if f.get("restriction") == "peanut"][0]
        self.assertEqual(peanut_finding["status"], "UNKNOWN / VERIFY")
        self.assertTrue(peanut_finding["requires_manual_confirmation"])

    def test_missing_nutrition_fact_is_not_provided_never_zero(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_without_sugars = (
            "INGREDIENTS: Pure rolled oats.\n"
            "NUTRITION FACTS (per 100g):\n"
            "Energy: 380 kcal\n"
            "Protein: 12 g"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_without_sugars,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        sugars_fact = data["nutrition_facts"].get("sugars")
        self.assertIsNotNone(sugars_fact)
        # Value must be None / null, status must be not_provided, NOT 0.0!
        self.assertIsNone(sugars_fact["value"])
        self.assertEqual(sugars_fact["status"], "not_provided")

class VerifyFieldsEndpointTests(APITestCase):
    def test_manual_field_correction_updates_findings(self):
        url = reverse('verify-fields')
        payload = {
            "ingredients": [
                {"name": "Whole milk", "source_text": "Whole milk", "status": "detected"}
            ],
            "allergen_statements": [],
            "nutrition_facts": {
                "sodium": {"value": 550, "unit": "mg", "basis": "per_100g", "status": "detected"}
            },
            "restrictions": ["milk"],
            "targets": {"sodium_max": 400},
            "raw_text": "Whole milk",
            "quality_tier": "CLEAR",
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        findings = data["findings"]
        milk_finding = [f for f in findings if f.get("restriction") == "milk"][0]
        self.assertEqual(milk_finding["status"], "CONFLICT DETECTED")

        sodium_finding = [f for f in findings if f.get("target") == "sodium_max"][0]
        self.assertEqual(sodium_finding["status"], "PREFERENCE MISMATCH")
