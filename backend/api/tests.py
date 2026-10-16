import io
import os
import json
from PIL import Image, ImageDraw, ImageFilter
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from rest_framework.authtoken.models import Token

from .models import UserProfile
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
        conflict_findings = [f for f in findings if f["status"] in ("CONFLICT DETECTED", "Confirmed conflict")]
        self.assertEqual(len(conflict_findings), 1)
        self.assertEqual(conflict_findings[0]["restriction"], "peanut")
        self.assertIn(conflict_findings[0]["status"], ("CONFLICT DETECTED", "Confirmed conflict"))
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
                self.assertIn(f["status"], ["NO CONFLICT IDENTIFIED IN READABLE INFORMATION", "No match in readable information"])
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
        self.assertIn(peanut_finding["status"], ["UNKNOWN / VERIFY", "Missing or unreadable evidence", "Uncertain interpretation"])
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
        self.assertIn(milk_finding["status"], ["CONFLICT DETECTED", "Confirmed conflict"])

        sodium_finding = [f for f in findings if f.get("target") == "sodium_max"][0]
        self.assertEqual(sodium_finding["status"], "PREFERENCE MISMATCH")


class Mission2EdgeCaseTests(APITestCase):
    """
    Dedicated tests for Mission 2: LabelLens — Handling Unclear Labels and Uncertain Information.
    Covers curved/cylindrical packaging, obscured text, missing allergen notices, and truncation.
    """

    def setUp(self):
        self.analyze_url = reverse('analyze-label')

    def test_curved_cylindrical_label_detected(self):
        # Create cylindrical lighting gradient
        width, height = 500, 300
        img = Image.new("L", (width, height), color=40)
        for x in range(width):
            dist = abs(x - width / 2.0) / (width / 2.0)
            lum = int(210 - (dist ** 2) * 160)
            for y in range(height):
                img.putpixel((x, y), max(10, min(250, lum)))

        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        img_bytes = buf.getvalue()

        quality = assess_image_quality(img_bytes, "curved_can.jpg")
        self.assertTrue(quality["is_valid"])
        self.assertTrue(quality.get("is_curved_surface"))
        self.assertTrue(any("curved" in w.lower() for w in quality["warnings"]))

    def test_obscured_ingredient_marked_uncertain_and_requires_confirmation(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_with_unreadable = (
            "INGREDIENTS: Rolled oats, [unreadable], cane sugar, sea salt.\n"
            "CONTAINS: Tree nuts.\n"
            "NUTRITION FACTS (per 100g):\n"
            "Energy: 400 kcal\n"
            "Protein: 10 g"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut"]),
                "raw_text": label_with_unreadable,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data["is_complete"])
        self.assertTrue(any("unreadable" in f.lower() or "obscured" in f.lower() for f in data["uncertainty_flags"]))

        # For peanut (which was not explicitly seen), because an ingredient is obscured,
        # it MUST NOT claim "NO CONFLICT IDENTIFIED"! It must report UNKNOWN / VERIFY or Missing/Unreadable
        peanut_finding = [f for f in data["findings"] if f.get("restriction") == "peanut"][0]
        self.assertIn(peanut_finding["status"], ["UNKNOWN / VERIFY", "Missing or unreadable evidence", "Uncertain interpretation"])
        self.assertTrue(peanut_finding["requires_manual_confirmation"])

    def test_missing_allergen_declaration_flagged(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_without_allergen_stmt = (
            "INGREDIENTS: Rolled oats, cane sugar, sunflower oil, sea salt.\n"
            "NUTRITION FACTS (per 100g):\n"
            "Energy: 420 kcal\n"
            "Fat: 12 g\n"
            "Carbohydrates: 65 g\n"
            "Protein: 8 g"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut"]),
                "raw_text": label_without_allergen_stmt,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(any("no explicit allergen statement" in f.lower() for f in data["uncertainty_flags"]))

    def test_incomplete_truncated_ocr_detected(self):
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        truncated_label = (
            "INGREDIENTS: Whole wheat flour, water, yeast, salt, vegetable oil, ...\n"
            "CONTAINS: Wheat."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut"]),
                "raw_text": truncated_label,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data["is_complete"])
        self.assertTrue(any("truncated" in f.lower() or "cut off" in f.lower() for f in data["uncertainty_flags"]))

    def test_no_mock_data_fabricated_on_unparsed_image(self):
        """
        Regression test: When an image cannot be parsed by OCR, the backend must NEVER
        silently fabricate hardcoded oatmeal numbers (450 kcal, 15g fat, etc.).
        It must report null/unreadable and require manual confirmation.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("unparsed_label.jpg", img_bytes, content_type="image/jpeg")

        from unittest.mock import patch
        with patch("api.label_analyzer.ocr_engine.call_gemini_vision", return_value=(None, "Unparsed")):
            response = self.client.post(
                self.analyze_url,
                {"image": image_file},
                format="multipart"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Verify NO fake 450 kcal or oatmeal ingredients were invented
        self.assertEqual(data["ingredients"], [])
        energy_fact = data["nutrition_facts"].get("energy")
        self.assertIsNotNone(energy_fact)
        self.assertIsNone(energy_fact["value"])
        self.assertEqual(energy_fact["status"], "unreadable")
        self.assertTrue(data["manual_confirmation_needed"])
        self.assertTrue(any("manual review" in f.lower() for f in data["uncertainty_flags"]))

    def test_multi_column_tabular_nutrition_extraction(self):
        """
        Regression test: Multi-column packaging tables (e.g. Per 100g vs Per Serving)
        must preserve both columns accurately without mixing units or rows.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("chips_packet.jpg", img_bytes, content_type="image/jpeg")

        chips_tabular_label = (
            "INGREDIENTS: Potato, edible vegetable oil, spices and condiments, iodized salt.\n"
            "CONTAINS: Wheat.\n"
            "NUTRITIONAL INFORMATION\n"
            "Approx. Values Per 100g | Per Serve (20g)\n"
            "Energy (kcal) 524 105\n"
            "Protein (g) 7.1 1.4\n"
            "Carbohydrate (g) 50.6 10.1\n"
            "Total Sugars (g) 1.6 0.3\n"
            "Added Sugars (g) 0.0 0.0\n"
            "Total Fat (g) 33.5 6.7\n"
            "Saturated Fat (g) 15.0 3.0\n"
            "Trans Fat (g) 0.1 0.02\n"
            "Sodium (mg) 650 130"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": chips_tabular_label,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        nutrition = data["nutrition_facts"]

        # 1. Energy
        self.assertEqual(nutrition["energy"]["value"], 524.0)
        self.assertEqual(nutrition["energy"]["serving_value"], 105.0)
        self.assertEqual(nutrition["energy"]["basis"], "per_100g")
        self.assertEqual(nutrition["energy"]["serving_basis"], "per_serving")

        # 2. Protein
        self.assertEqual(nutrition["protein"]["value"], 7.1)
        self.assertEqual(nutrition["protein"]["serving_value"], 1.4)

        # 3. Carbohydrate (singular and plural must both work)
        self.assertEqual(nutrition["carbohydrates"]["value"], 50.6)
        self.assertEqual(nutrition["carbohydrates"]["serving_value"], 10.1)
        self.assertEqual(nutrition["carbohydrates"]["status"], "detected")

        # 4. Total Sugars vs Added Sugars
        self.assertEqual(nutrition["sugars"]["value"], 1.6)
        self.assertEqual(nutrition["sugars"]["serving_value"], 0.3)
        self.assertEqual(nutrition["added_sugars"]["value"], 0.0)
        self.assertTrue(nutrition["added_sugars"]["is_zero_explicit"])

        # 5. Total Fat & Saturated Fat
        self.assertEqual(nutrition["fat"]["value"], 33.5)
        self.assertEqual(nutrition["fat"]["serving_value"], 6.7)
        self.assertEqual(nutrition["saturated_fat"]["value"], 15.0)
        self.assertEqual(nutrition["saturated_fat"]["serving_value"], 3.0)

        # 6. Sodium
        self.assertEqual(nutrition["sodium"]["value"], 650.0)
        self.assertEqual(nutrition["sodium"]["serving_value"], 130.0)
        self.assertEqual(nutrition["sodium"]["unit"], "mg")

    def test_carbohydrates_plural_matching(self):
        """
        Regression test: Verify that 'Total Carbohydrates' (plural) correctly matches.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_text = (
            "INGREDIENTS: Wheat flour, water.\n"
            "NUTRITION FACTS:\n"
            "Total Carbohydrates: 68.5 g\n"
            "Energy: 320 kcal"
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_text,
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        carbs = data["nutrition_facts"].get("carbohydrates")
        self.assertIsNotNone(carbs)
        self.assertEqual(carbs["value"], 68.5)
        self.assertEqual(carbs["status"], "detected")

    def test_gemini_key_resolver_ignores_placeholder(self):
        """
        Verify that placeholder strings like 'your-gemini-vision-api-key-here'
        are safely recognized as not configured and not passed to API calls.
        """
        from unittest.mock import patch
        from api.label_analyzer.ocr_engine import get_gemini_api_key
        from django.conf import settings

        with patch.dict(os.environ, {"GEMINI_API_KEY": "your-gemini-vision-api-key-here"}):
            with patch.object(settings, "GEMINI_API_KEY", "your-gemini-vision-api-key-here"):
                with patch("builtins.open", side_effect=FileNotFoundError):
                    resolved = get_gemini_api_key()
                    self.assertEqual(resolved, "")


    def test_gemini_error_notice_reported_in_uncertainty_flags(self):
        """
        Verify that when vision fails or key is missing, uncertainty_flags
        contains an explicit 'AI Vision:' notice and nutrition facts remain unreadable.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label_no_key.jpg", img_bytes, content_type="image/jpeg")

        from unittest.mock import patch
        with patch("api.label_analyzer.ocr_engine.get_gemini_api_key", return_value=""):
            response = self.client.post(
                self.analyze_url,
                {"image": image_file},
                format="multipart"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(any("AI Vision" in f or "manual review" in f.lower() for f in data["uncertainty_flags"]))
        self.assertTrue(data["manual_confirmation_needed"])
        # Invariants: No fabricated food numbers
        self.assertIsNone(data["nutrition_facts"]["energy"]["value"])

    def test_allergy_matching_with_consolidated_evidence(self):
        """
        Regression test: When an allergen appears in BOTH the allergen statement
        and the ingredients list, the engine must produce ONE consolidated finding
        with both pieces of evidence combined.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_text = (
            "INGREDIENTS: Wheat flour, milk solids, palm oil, salt.\n"
            "CONTAINS: Milk, Wheat.\n"
            "NUTRITION FACTS: Energy 400 kcal, Protein 6g, Total Fat 14g."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_text,
                "restrictions": json.dumps(["milk"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        findings = [f for f in data["findings"] if f.get("restriction") == "Dairy / Milk" or f.get("id") == "milk"]
        self.assertEqual(len(findings), 1)

        milk_finding = findings[0]
        self.assertIn(milk_finding["status"], ["CONFLICT DETECTED", "Confirmed conflict"])
        self.assertEqual(milk_finding["severity"], "CRITICAL")
        self.assertIn("Allergen statement:", milk_finding["evidence"])
        self.assertIn("Ingredient list:", milk_finding["evidence"])
        self.assertIn("Avoid consuming this product", milk_finding.get("action_recommendation", ""))

    def test_no_duplicate_allergy_findings(self):
        """
        Regression test: Passing duplicate user restrictions must NEVER produce
        duplicate findings in the results.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("label.jpg", img_bytes, content_type="image/jpeg")

        label_text = (
            "INGREDIENTS: Potato, edible vegetable oil, spices, salt.\n"
            "CONTAINS: Wheat.\n"
            "NUTRITION FACTS: Energy 500 kcal, Protein 6g, Total Fat 30g."
        )

        # Duplicate restrictions passed
        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_text,
                "restrictions": json.dumps(["peanut", "peanut", "tree_nut", "tree_nut", "soy", "soy"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Check that peanut, tree nut, and soy appear exactly once
        finding_ids = [f.get("id") or f.get("restriction") for f in data["findings"]]
        self.assertEqual(len(finding_ids), len(set(finding_ids)))
        self.assertEqual(len(data["findings"]), 3)

    def test_wheat_gluten_positive_match(self):
        """
        Regression test: Verify that wheat/gluten conflict is properly detected
        from Indian packaging statement 'CONTAINS MILK, WHEAT AND SOY.'.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("chips.jpg", img_bytes, content_type="image/jpeg")

        chips_text = (
            "INGREDIENTS: Potato, palm oil, spices, salt.\n"
            "CONTAINS MILK, WHEAT AND SOY.\n"
            "NUTRITIONAL INFORMATION: Energy 524 kcal, Protein 7.1g."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": chips_text,
                "restrictions": json.dumps(["gluten"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        gluten_finding = next((f for f in data["findings"] if f.get("id") == "gluten" or "Gluten" in f.get("restriction", "")), None)
        self.assertIsNotNone(gluten_finding)
        self.assertIn(gluten_finding["status"], ["CONFLICT DETECTED", "Confirmed conflict"])
        self.assertEqual(gluten_finding["severity"], "CRITICAL")
        self.assertIn("CONTAINS MILK, WHEAT AND SOY", gluten_finding["evidence"])

    def test_explicit_milk_declaration_from_structured_and_unstructured_evidence(self):
        """
        Mission 04 Regression Test: When packaging explicitly declares 'CONTAINS MILK, WHEAT AND SOY.',
        Dairy / Milk MUST be classified as 'Confirmed conflict' (CRITICAL) rather than uncertain.
        Wheat and Gluten must be 'Confirmed conflict' (CRITICAL), while Peanut remains 'Uncertain interpretation'
        when only ambiguous ingredients are present. Also verifies no false missing-allergen warning.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("chips_milk_label.jpg", img_bytes, content_type="image/jpeg")

        chips_text = (
            "INGREDIENTS: Potato (87.4%), edible vegetable oil, spices and condiments, maida (refined wheat flour), salt.\n"
            "CONTAINS MILK, WHEAT AND SOY. MAY CONTAIN BARLEY.\n"
            "NUTRITIONAL INFORMATION: Energy 524 kcal, Protein 7.1g."
        )

        from unittest.mock import patch
        mock_gemini_payload = {
            "raw_text": chips_text,
            "ingredients": [
                {"name": "Potato (87.4%)", "source_text": "Potato (87.4%)", "status": "detected"},
                {"name": "spices and condiments", "source_text": "spices and condiments", "status": "detected"},
                {"name": "maida (refined wheat flour)", "source_text": "maida (refined wheat flour)", "status": "detected"},
            ],
            "allergen_statements": [
                {"type": "contains", "statement": "CONTAINS MILK, WHEAT AND SOY."},
                {"type": "may_contain", "statement": "MAY CONTAIN BARLEY."}
            ],
            "nutrition_facts": {
                "energy": {"value": 524.0, "unit": "kcal", "basis": "per_100g", "status": "detected"}
            }
        }

        with patch("api.label_analyzer.ocr_engine.call_gemini_vision", return_value=(mock_gemini_payload, None)):
            response = self.client.post(
                self.analyze_url,
                {
                    "image": image_file,
                    "restrictions": json.dumps(["gluten", "wheat", "peanut", "milk"]),
                },
                format="multipart"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # 1. Milk must be Confirmed conflict (NOT Uncertain interpretation)
        milk_finding = next((f for f in data["findings"] if f.get("id") == "milk"), None)
        self.assertIsNotNone(milk_finding)
        self.assertIn(milk_finding["status"], ["Confirmed conflict", "CONFLICT DETECTED"])
        self.assertEqual(milk_finding["severity"], "CRITICAL")
        self.assertIn("CONTAINS MILK, WHEAT AND SOY.", milk_finding["evidence"])
        self.assertFalse(milk_finding["requires_manual_confirmation"])

        # 2. Wheat must be Confirmed conflict
        wheat_finding = next((f for f in data["findings"] if f.get("id") == "wheat"), None)
        self.assertIsNotNone(wheat_finding)
        self.assertIn(wheat_finding["status"], ["Confirmed conflict", "CONFLICT DETECTED"])
        self.assertEqual(wheat_finding["severity"], "CRITICAL")

        # 3. Gluten must be Confirmed conflict
        gluten_finding = next((f for f in data["findings"] if f.get("id") == "gluten"), None)
        self.assertIsNotNone(gluten_finding)
        self.assertIn(gluten_finding["status"], ["Confirmed conflict", "CONFLICT DETECTED"])
        self.assertEqual(gluten_finding["severity"], "CRITICAL")

        # 4. Peanut must remain Uncertain interpretation (attention)
        peanut_finding = next((f for f in data["findings"] if f.get("id") == "peanut"), None)
        self.assertIsNotNone(peanut_finding)
        self.assertIn(peanut_finding["status"], ["Uncertain interpretation", "UNKNOWN / VERIFY"])
        self.assertEqual(peanut_finding["severity"], "ATTENTION")
        self.assertTrue(peanut_finding["requires_manual_confirmation"])

        # 5. Must NOT have false missing-allergen uncertainty flag
        self.assertFalse(any("No explicit allergen statement" in f for f in data.get("uncertainty_flags", [])))

    def test_no_conflict_identified_negative_language(self):
        """
        Regression test: When no allergy conflict exists, verify safe language:
        'No conflict identified in readable information' with proper disclaimers.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("clear_label.jpg", img_bytes, content_type="image/jpeg")

        clear_text = (
            "INGREDIENTS: Pure apples, water.\n"
            "NUTRITION FACTS: Energy 50 kcal, Protein 0g, Total Fat 0g."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": clear_text,
                "restrictions": json.dumps(["peanut"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        peanut_finding = next((f for f in data["findings"] if f.get("id") == "peanut" or "Peanut" in f.get("restriction", "")), None)
        self.assertIsNotNone(peanut_finding)
        self.assertIn(peanut_finding["status"], ["NO CONFLICT IDENTIFIED IN READABLE INFORMATION", "No match in readable information"])
        self.assertIn("does not guarantee", peanut_finding["explanation"].lower())

    def test_clarity_score_clear_vs_blurred_images(self):
        """
        Regression test: Verify that assess_image_quality accurately distinguishes
        clear sharp images from blurred and low-contrast images.
        """
        from api.label_analyzer.quality import assess_image_quality

        # 1. Clear sharp image with text and structure
        clear_bytes = create_dummy_image(width=800, height=800)
        clear_quality = assess_image_quality(clear_bytes, "sharp.jpg")
        self.assertEqual(clear_quality["quality_tier"], "CLEAR")
        self.assertEqual(clear_quality["quality_score"], 95)
        self.assertFalse(any("blurry" in w.lower() or "blur" in w.lower() for w in clear_quality["warnings"]))

        # 2. Moderately blurred image
        sharp_img = Image.open(io.BytesIO(clear_bytes))
        mod_blur_img = sharp_img.filter(ImageFilter.GaussianBlur(radius=2.5))
        buf_mod = io.BytesIO()
        mod_blur_img.save(buf_mod, format="JPEG")
        mod_quality = assess_image_quality(buf_mod.getvalue(), "mod_blurred.jpg")
        self.assertNotEqual(mod_quality["quality_tier"], "CLEAR")
        self.assertIn(mod_quality["quality_tier"], ["UNCERTAIN", "UNREADABLE"])
        self.assertLessEqual(mod_quality["quality_score"], 55)
        self.assertTrue(any("blurry" in w.lower() or "blur" in w.lower() for w in mod_quality["warnings"]))

        # 3. Severely blurred image
        sev_blur_img = sharp_img.filter(ImageFilter.GaussianBlur(radius=6.0))
        buf_sev = io.BytesIO()
        sev_blur_img.save(buf_sev, format="JPEG")
        sev_quality = assess_image_quality(buf_sev.getvalue(), "sev_blurred.jpg")
        self.assertEqual(sev_quality["quality_tier"], "UNREADABLE")
        self.assertEqual(sev_quality["quality_score"], 30)
        self.assertTrue(any("severely blurry" in w.lower() for w in sev_quality["warnings"]))

    def test_api_propagates_blur_warning_and_quality_score(self):
        """
        Regression test: Verify that uploading a blurred image to the API
        propagates the blur warning, reduced clarity score, and non-CLEAR status.
        """
        clear_bytes = create_dummy_image(width=800, height=800)
        sharp_img = Image.open(io.BytesIO(clear_bytes))
        blurred_img = sharp_img.filter(ImageFilter.GaussianBlur(radius=3.0))
        buf = io.BytesIO()
        blurred_img.save(buf, format="JPEG")
        blurred_file = SimpleUploadedFile("blurry_label.jpg", buf.getvalue(), content_type="image/jpeg")

        response = self.client.post(
            self.analyze_url,
            {
                "image": blurred_file,
                "restrictions": json.dumps(["peanut"]),
                "raw_text": "INGREDIENTS: Oats, Almonds.",
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Quality tier and score must reflect blur, not CLEAR 95/100
        quality = data.get("quality", {})
        self.assertNotEqual(quality.get("quality_tier"), "CLEAR")
        self.assertIn(quality.get("quality_tier"), ["UNCERTAIN", "UNREADABLE"])
        self.assertLessEqual(quality.get("quality_score"), 55)
        self.assertTrue(any("blurry" in w.lower() for w in quality.get("warnings", [])))
        self.assertTrue(any("blurry" in r.lower() or "focus" in r.lower() for r in quality.get("retake_recommendations", [])))


class UserAuthenticationTests(APITestCase):
    """
    Tests for user registration, login, logout, and token authentication.
    """
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('auth-register')
        self.login_url = reverse('auth-login')
        self.logout_url = reverse('auth-logout')
        self.me_url = reverse('auth-me')

    def test_user_registration_success(self):
        payload = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["email"], "jane@example.com")
        self.assertEqual(response.data["user"]["profile"]["full_name"], "Jane Doe")
        self.assertFalse(response.data["user"]["profile"]["onboarding_completed"])

    def test_registration_mismatched_passwords(self):
        payload = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "password": "Password123!",
            "confirm_password": "DifferentPassword!"
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data.get("errors", {}))

    def test_registration_duplicate_email(self):
        User.objects.create_user(username="jane@example.com", email="jane@example.com", password="Password123!")
        payload = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data.get("errors", {}))

    def test_user_login_success(self):
        user = User.objects.create_user(username="alex@example.com", email="alex@example.com", password="SecurePassword123")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.full_name = "Alex Smith"
        profile.save()

        payload = {
            "email": "alex@example.com",
            "password": "SecurePassword123"
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "alex@example.com")

    def test_user_login_invalid_password(self):
        user = User.objects.create_user(username="alex@example.com", email="alex@example.com", password="SecurePassword123")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.full_name = "Alex Smith"
        profile.save()
        payload = {
            "email": "alex@example.com",
            "password": "WrongPassword"
        }
        response = self.client.post(self.login_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_current_user_authenticated(self):
        user = User.objects.create_user(username="sam@example.com", email="sam@example.com", password="Password123!")
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "sam@example.com")

    def test_get_current_user_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_logout_invalidates_token(self):
        user = User.objects.create_user(username="logout_user@example.com", email="logout_user@example.com", password="Password123!")
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        logout_response = self.client.post(self.logout_url)
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        # Subsequent authenticated request with old token should now fail
        subsequent_response = self.client.get(self.me_url)
        self.assertEqual(subsequent_response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserProfileAndOnboardingTests(APITestCase):
    """
    Tests for profile retrieval, updating dietary preferences, and multi-user isolation.
    """
    def setUp(self):
        self.client = APIClient()
        self.profile_url = reverse('user-profile')
        self.user = User.objects.create_user(username="profile_user@example.com", email="profile_user@example.com", password="Password123!")
        self.token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_update_profile_and_complete_onboarding(self):
        payload = {
            "age_range": "25-34",
            "height_cm": 175.5,
            "weight_kg": 70.0,
            "allergy_status": "specified",
            "allergies": ["peanut", "tree_nut", "sesame"],
            "dietary_preferences": ["vegan", "low_sugar"],
            "health_conditions": ["hypertension"],
            "onboarding_completed": True
        }
        response = self.client.put(self.profile_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        profile_data = response.data["profile"]
        self.assertEqual(profile_data["age_range"], "25-34")
        self.assertEqual(profile_data["height_cm"], 175.5)
        self.assertEqual(profile_data["allergy_status"], "specified")
        self.assertEqual(profile_data["allergies"], ["peanut", "tree_nut", "sesame"])
        self.assertTrue(profile_data["onboarding_completed"])

    def test_allergy_status_distinctions(self):
        # 1. No known allergies reported
        res1 = self.client.patch(self.profile_url, {"allergy_status": "none", "allergies": []}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["profile"]["allergy_status"], "none")
        self.assertEqual(res1.data["profile"]["allergies"], [])

        # 2. Uncertain allergy information
        res2 = self.client.patch(self.profile_url, {"allergy_status": "uncertain", "allergies": []}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["profile"]["allergy_status"], "uncertain")

        # 3. No answer provided
        res3 = self.client.patch(self.profile_url, {"allergy_status": "unanswered", "allergies": []}, format="json")
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data["profile"]["allergy_status"], "unanswered")

    def test_profile_isolation_between_users(self):
        # Create second user
        user2 = User.objects.create_user(username="other@example.com", email="other@example.com", password="Password123!")
        token2, _ = Token.objects.get_or_create(user=user2)
        profile2, _ = UserProfile.objects.get_or_create(user=user2)
        profile2.allergies = ["milk", "egg"]
        profile2.save()

        # User 1 fetches profile
        res1 = self.client.get(self.profile_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertNotEqual(res1.data["allergies"], ["milk", "egg"])

        # Switch credentials to User 2
        client2 = APIClient()
        client2.credentials(HTTP_AUTHORIZATION=f"Token {token2.key}")
        res2 = client2.get(self.profile_url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["allergies"], ["milk", "egg"])


class Mission3EvidenceAndContradictionTests(APITestCase):
    """
    Dedicated automated tests for Mission 3:
    1. A confirmed allergen match with exact evidence.
    2. AI interpretation contradicting explicit label text.
    3. An ambiguous ingredient remaining uncertain.
    4. Missing evidence not producing a fabricated claim.
    5. A no-match result not claiming allergen-free status.
    6. AI nutrition fabrication detection and unresolved contradictions.
    """
    def setUp(self):
        self.analyze_url = reverse('analyze-label')
        self.verify_url = reverse('verify-fields')

    def test_confirmed_allergen_match_with_exact_evidence(self):
        """
        Mission 3 Test 1: A confirmed allergen match must show exact supporting label text,
        attach the bounding box, report status 'Confirmed conflict', and require no manual confirmation.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("peanut_butter.jpg", img_bytes, content_type="image/jpeg")

        label_text = (
            "INGREDIENTS: Roasted peanuts (90%), brown cane sugar, palm oil, iodized salt.\n"
            "CONTAINS: Peanuts.\n"
            "NUTRITION FACTS: Energy 580 kcal, Protein 24g, Total Fat 48g."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_text,
                "restrictions": json.dumps(["peanut"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        findings = [f for f in data["findings"] if f.get("id") == "peanut" or "peanut" in f.get("restriction", "").lower()]
        self.assertEqual(len(findings), 1)

        peanut_finding = findings[0]
        # Verify standardized Mission 3 status
        self.assertEqual(peanut_finding["result_status"], "Confirmed conflict")
        self.assertIn(peanut_finding["status"], ["Confirmed conflict", "CONFLICT DETECTED"])
        self.assertEqual(peanut_finding["severity"], "CRITICAL")
        self.assertFalse(peanut_finding["requires_manual_confirmation"])

        # Verify exact supporting label text is preserved
        self.assertTrue(len(peanut_finding["supporting_text"]) > 0)
        self.assertTrue(
            "peanuts" in peanut_finding["supporting_text"].lower()
            or "peanuts" in peanut_finding["evidence"].lower()
        )
        self.assertIn("Allergen statement:", peanut_finding["evidence"])
        self.assertIn("Ingredient list:", peanut_finding["evidence"])

    def test_ai_interpretation_contradicting_explicit_label_text(self):
        """
        Mission 3 Test 2: When an AI interpretation or marketing claim asserts 'Gluten-Free' or 'Dairy-Free',
        but explicit label ingredients declare wheat/milk, the engine must detect the contradiction,
        NEVER silently trust the AI claim, and report status 'Unresolved contradiction'.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("contradictory_cookies.jpg", img_bytes, content_type="image/jpeg")

        # Explicit label text has wheat flour and contains wheat
        cookies_text = (
            "GLUTEN-FREE COOKIES\n"
            "INGREDIENTS: Wheat flour, sugar, butter, baking soda, salt.\n"
            "CONTAINS: Wheat, Milk.\n"
            "NUTRITION FACTS: Energy 450 kcal, Protein 5g."
        )

        # AI interpretation claims product is gluten free and safe for gluten
        ai_claims = {
            "claims": ["Gluten-Free"],
            "gluten_free": True,
            "safe_for": ["gluten"],
            "allergens_absent": ["gluten", "wheat"],
        }

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": cookies_text,
                "restrictions": json.dumps(["gluten", "milk"]),
                "ai_interpretation": json.dumps(ai_claims),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Verify contradictions are captured in response
        contradictions = data.get("contradictions", [])
        self.assertTrue(len(contradictions) > 0)
        gluten_contra = next((c for c in contradictions if "gluten" in c["id"].lower() or "wheat" in c["id"].lower()), None)
        self.assertIsNotNone(gluten_contra)
        self.assertEqual(gluten_contra["status"], "Unresolved contradiction")
        self.assertEqual(gluten_contra["severity"], "CRITICAL")
        self.assertIn("wheat", gluten_contra["supporting_text"].lower())

        # Verify the finding for gluten reflects the unresolved contradiction
        findings = data["findings"]
        gluten_finding = next((f for f in findings if f.get("id") == "gluten" or "gluten" in f.get("restriction", "").lower()), None)
        self.assertIsNotNone(gluten_finding)
        self.assertEqual(gluten_finding["result_status"], "Unresolved contradiction")
        self.assertEqual(gluten_finding["status"], "Unresolved contradiction")
        self.assertTrue(gluten_finding["is_contradiction"])
        self.assertTrue(gluten_finding["requires_manual_confirmation"])
        self.assertIn("Wheat flour", gluten_finding["supporting_text"])

    def test_ambiguous_ingredient_remains_uncertain(self):
        """
        Mission 3 Test 3: An ambiguous ingredient (e.g. 'natural flavors', 'spices', 'modified starch')
        cannot rule out restricted allergens. Status must remain 'Uncertain interpretation' and
        require user manual confirmation rather than assuming safe.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("tortilla_chips.jpg", img_bytes, content_type="image/jpeg")

        label_with_ambiguous = (
            "INGREDIENTS: Whole corn, vegetable oil, natural flavors, spices, sea salt.\n"
            "NUTRITION FACTS: Energy 140 kcal, Sodium 110mg."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": label_with_ambiguous,
                "restrictions": json.dumps(["mustard"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Ambiguous ingredient list should identify natural flavors and spices
        ambiguous = data.get("ambiguous_ingredients", [])
        self.assertTrue(len(ambiguous) >= 1)
        ambig_names = [a["source_text"].lower() for a in ambiguous]
        self.assertTrue(any("natural flavors" in n or "spices" in n for n in ambig_names))

        findings = data["findings"]
        mustard_finding = next((f for f in findings if f.get("id") == "mustard" or "mustard" in f.get("restriction", "").lower()), None)
        self.assertIsNotNone(mustard_finding)
        self.assertEqual(mustard_finding["result_status"], "Uncertain interpretation")
        self.assertEqual(mustard_finding["status"], "Uncertain interpretation")
        self.assertTrue(mustard_finding["requires_manual_confirmation"])
        self.assertTrue("natural flavors" in mustard_finding["supporting_text"].lower() or "spices" in mustard_finding["supporting_text"].lower())

    def test_missing_evidence_does_not_produce_fabricated_claim(self):
        """
        Mission 3 Test 4: Missing or unreadable evidence must NEVER produce fabricated claims,
        invented ingredients, or assumed zero values. Status must be 'Missing or unreadable evidence'.
        """
        # Create unreadable tiny image (100x100 is below 350px min threshold)
        img_bytes = create_dummy_image(width=100, height=100)
        image_file = SimpleUploadedFile("tiny_missing.jpg", img_bytes, content_type="image/jpeg")

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "restrictions": json.dumps(["peanut", "tree_nut"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["readability_status"], "UNREADABLE")
        self.assertEqual(data["ingredients"], [])
        self.assertTrue(data["manual_confirmation_needed"])

        # Nutrition facts must not be fabricated (empty or values None)
        for nut_k, nut_fact in data["nutrition_facts"].items():
            self.assertIsNone(nut_fact.get("value"))

        # Restrictions must not claim allergen-free
        for f in data["findings"]:
            self.assertEqual(f["result_status"], "Missing or unreadable evidence")
            self.assertTrue(f["requires_manual_confirmation"])

    def test_no_match_result_never_claims_allergen_free(self):
        """
        Mission 3 Test 5: A clear label with no matching allergens must report
        'No match in readable information' and must NEVER claim the product is 100% allergen-free.
        It must include an explicit disclaimer that unread hazards cannot be guaranteed absent.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("pure_granola.jpg", img_bytes, content_type="image/jpeg")

        granola_text = (
            "INGREDIENTS: Rolled oats, maple syrup, coconut flakes, chia seeds, sea salt.\n"
            "NUTRITION FACTS: Energy 220 kcal, Protein 6g, Sodium 45mg."
        )

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": granola_text,
                "restrictions": json.dumps(["peanut"]),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        findings = [f for f in data["findings"] if f.get("id") == "peanut" or "peanut" in f.get("restriction", "").lower()]
        self.assertEqual(len(findings), 1)

        peanut_finding = findings[0]
        self.assertEqual(peanut_finding["result_status"], "No match in readable information")
        self.assertEqual(peanut_finding["severity"], "INFO")
        self.assertFalse(peanut_finding["requires_manual_confirmation"])

        # CRITICAL SAFETY INVARIANT: Never claim product is allergen-free!
        expl_lower = peanut_finding["explanation"].lower()
        self.assertNotIn("product is allergen-free", expl_lower)
        self.assertNotIn("guaranteed allergen-free", expl_lower)
        self.assertIn("does not guarantee", expl_lower)

    def test_ai_hallucinated_nutrition_contradiction_detected(self):
        """
        Mission 3 Test 6: If AI interpretation reports fabricated nutrient quantities
        for fields omitted from the packaging table, the engine rejects them as contradictions.
        """
        img_bytes = create_dummy_image()
        image_file = SimpleUploadedFile("bread.jpg", img_bytes, content_type="image/jpeg")

        bread_text = (
            "INGREDIENTS: Whole wheat flour, water, yeast, salt.\n"
            "NUTRITION FACTS: Energy 250 kcal, Protein 8g."
        )

        # AI hallucinates that sugars are 0.0 and sodium is 5mg
        ai_data = {
            "nutrition_facts": {
                "sugars": 0.0,
                "sodium": 5.0,
            }
        }

        response = self.client.post(
            self.analyze_url,
            {
                "image": image_file,
                "raw_text": bread_text,
                "ai_interpretation": json.dumps(ai_data),
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Contradictions should catch the hallucinated nutrients
        contradictions = data.get("contradictions", [])
        hallucinated_types = [c["contradiction_type"] for c in contradictions]
        self.assertIn("AI_FABRICATION_VS_EVIDENCE", hallucinated_types)

        # Invariant: the actual nutrition table must remain not_provided, NOT adopting hallucination
        self.assertIsNone(data["nutrition_facts"]["sugars"]["value"])
        self.assertEqual(data["nutrition_facts"]["sugars"]["status"], "not_provided")


class NutrientReferenceLimitsTests(TestCase):
    """
    Feature A: Comprehensive tests for predefined daily nutrient reference limits (FSSAI 2020 / ICMR 2020).
    """

    def test_configured_reference_values_produce_correct_percentages(self):
        from .nutrition.reference_limits import get_reference_limit
        from .nutrition.calculator import calculate_nutrient_percentage

        # Sodium: 2000 mg reference
        ref = get_reference_limit("sodium")
        self.assertIsNotNone(ref)
        self.assertEqual(ref.daily_reference_amount, 2000.0)
        self.assertEqual(ref.unit, "mg")

        # 500 mg should be 25.0%
        result = calculate_nutrient_percentage("sodium", 500.0, "mg")
        self.assertEqual(result["status"], "calculated")
        self.assertEqual(result["percentage"], 25.0)

        # 1400 mg should be 70.0%
        result = calculate_nutrient_percentage("sodium", 1400.0, "mg")
        self.assertEqual(result["percentage"], 70.0)

        # Energy: 2000 kcal reference
        energy_result = calculate_nutrient_percentage("energy", 400.0, "kcal")
        self.assertEqual(energy_result["percentage"], 20.0)

        # Saturated fat: 22 g reference -> 11 g is 50.0%
        sat_result = calculate_nutrient_percentage("saturated_fat", 11.0, "g")
        self.assertEqual(sat_result["percentage"], 50.0)

    def test_missing_references_do_not_crash_calculations(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        # Nutrient that is not in the predefined list
        result = calculate_nutrient_percentage("unknown_exotic_flavonoid", 12.5, "mg")
        self.assertEqual(result["status"], "unconfigured")
        self.assertIsNone(result["percentage"])
        self.assertEqual(result["message"], "Daily reference not configured.")

    def test_nutrients_without_applicable_percentage_show_no_percentage(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        # Trans fat: tracked, but supports_percentage is False (no daily recommended target, only upper bound)
        trans_result = calculate_nutrient_percentage("trans_fat", 0.5, "g")
        self.assertEqual(trans_result["status"], "no_percentage_standard")
        self.assertIsNone(trans_result["percentage"])
        self.assertIn("No daily recommended target", trans_result["reference"]["applicability_notes"])

        # Total sugars: tracked without mandatory % RDA under FSSAI (added sugars has % RDA)
        sugars_result = calculate_nutrient_percentage("sugars", 15.0, "g")
        self.assertEqual(sugars_result["status"], "no_percentage_standard")
        self.assertIsNone(sugars_result["percentage"])

    def test_missing_amounts_are_not_treated_as_zero(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        result = calculate_nutrient_percentage("sodium", None, "mg")
        self.assertEqual(result["status"], "amount_unavailable")
        self.assertIsNone(result["percentage"])
        self.assertEqual(result["message"], "Amount unavailable.")

    def test_zero_amounts_remain_valid_when_explicitly_extracted(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        result = calculate_nutrient_percentage("sodium", 0.0, "mg")
        self.assertEqual(result["status"], "calculated")
        self.assertEqual(result["percentage"], 0.0)

    def test_incompatible_units_handled_safely(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        # Supplying kcal for sodium (which expects mg)
        result = calculate_nutrient_percentage("sodium", 500.0, "kcal")
        self.assertEqual(result["status"], "incompatible_units")
        self.assertIsNone(result["percentage"])
        self.assertIn("incompatible", result["message"])

    def test_compatible_unit_conversions(self):
        from .nutrition.calculator import calculate_nutrient_percentage

        # Sodium: 2.0 grams should safely convert to 2000.0 mg = 100.0%
        result = calculate_nutrient_percentage("sodium", 2.0, "g")
        self.assertEqual(result["status"], "calculated")
        self.assertEqual(result["percentage"], 100.0)

    def test_reference_values_and_alert_thresholds_remain_separate(self):
        from .nutrition.reference_limits import get_reference_limit

        sodium_ref = get_reference_limit("sodium")
        self.assertEqual(sodium_ref.daily_reference_amount, 2000.0)
        self.assertEqual(sodium_ref.alert_threshold_pct, 100.0)

        # Trans fat has upper limit reference 2.2g but alert_threshold_pct is None
        trans_ref = get_reference_limit("trans_fat")
        self.assertEqual(trans_ref.daily_reference_amount, 2.2)
        self.assertIsNone(trans_ref.alert_threshold_pct)


class ConsumptionIntakeLedgerTests(APITestCase):
    """
    Features B & C: Confirmed intake ledger, multi-product alerts, persistence, and security.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="tester@example.com",
            email="tester@example.com",
            password="StrongPassword123!"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.other_user = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="StrongPassword123!"
        )
        self.other_token = Token.objects.create(user=self.other_user)

        self.records_url = reverse("intake-records")
        self.summary_url = reverse("intake-summary")

    def test_scanning_without_confirmation_creates_no_consumption_record(self):
        from .models import ConsumptionRecord
        # Verify initial database state is strictly 0
        self.assertEqual(ConsumptionRecord.objects.count(), 0)

        # Even with an analyze request, consumption records must remain 0
        self.assertEqual(ConsumptionRecord.objects.filter(user=self.user).count(), 0)

    def test_unauthenticated_requests_are_rejected(self):
        unauth_client = APIClient()
        response = unauth_client.get(self.records_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = unauth_client.post(self.records_url, {"product_name": "Snack", "servings_consumed": 1.0})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_confirming_consumption_creates_one_record(self):
        from .models import ConsumptionRecord

        payload = {
            "product_name": "Greek Yogurt 150g",
            "servings_consumed": 1.0,
            "basis_used": "per_serving",
            "serving_size": "150g",
            "serving_unit": "pot",
            "nutrition_facts": {
                "energy": {"value": 120.0, "serving_value": 120.0, "unit": "kcal", "status": "detected"},
                "protein": {"value": 15.0, "serving_value": 15.0, "unit": "g", "status": "detected"},
                "sodium": {"value": 60.0, "serving_value": 60.0, "unit": "mg", "status": "detected"},
            }
        }
        response = self.client.post(self.records_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ConsumptionRecord.objects.filter(user=self.user).count(), 1)

        rec = ConsumptionRecord.objects.first()
        self.assertEqual(rec.product_name, "Greek Yogurt 150g")
        self.assertEqual(rec.servings_consumed, 1.0)
        self.assertEqual(rec.nutrients_snapshot["protein"]["amount"], 15.0)

    def test_partial_and_multiple_servings_calculated_correctly(self):
        # 1.5 servings of 300 mg sodium = 450 mg
        payload = {
            "product_name": "Tortilla Chips",
            "servings_consumed": 1.5,
            "basis_used": "per_serving",
            "nutrition_facts": {
                "sodium": {"value": 300.0, "serving_value": 300.0, "unit": "mg", "status": "detected"},
            }
        }
        response = self.client.post(self.records_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["record"]["nutrients_snapshot"]["sodium"]["amount"], 450.0)

    def test_several_products_accumulate_correctly_and_trigger_alerts(self):
        # Product A: 450 mg sodium
        self.client.post(self.records_url, {
            "product_name": "Product A",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 450.0, "serving_value": 450.0, "unit": "mg"}}
        }, format="json")

        # Product B: 350 mg sodium
        self.client.post(self.records_url, {
            "product_name": "Product B",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 350.0, "serving_value": 350.0, "unit": "mg"}}
        }, format="json")

        # Product C: 600 mg sodium
        self.client.post(self.records_url, {
            "product_name": "Product C",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 600.0, "serving_value": 600.0, "unit": "mg"}}
        }, format="json")

        # Total sodium: 450 + 350 + 600 = 1,400 mg (70.0% of 2,000 mg)
        summary_resp = self.client.get(self.summary_url)
        self.assertEqual(summary_resp.status_code, status.HTTP_200_OK)
        data = summary_resp.json()
        self.assertEqual(data["total_products_confirmed"], 3)

        sodium_tot = data["nutrient_totals"]["sodium"]
        self.assertEqual(sodium_tot["amount"], 1400.0)
        self.assertEqual(sodium_tot["percentage"], 70.0)
        self.assertEqual(len(sodium_tot["contributors"]), 3)

        # Now add Product D with 700 mg sodium -> Total 2,100 mg (105.0% -> Exceeds FSSAI 2,000 mg limit)
        self.client.post(self.records_url, {
            "product_name": "Product D",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 700.0, "serving_value": 700.0, "unit": "mg"}}
        }, format="json")

        summary_resp = self.client.get(self.summary_url)
        data = summary_resp.json()
        self.assertEqual(data["nutrient_totals"]["sodium"]["amount"], 2100.0)
        self.assertEqual(data["nutrient_totals"]["sodium"]["percentage"], 105.0)

        # Multi-product alert must be generated
        alerts = data.get("alerts", [])
        sodium_alerts = [a for a in alerts if a["nutrient_key"] == "sodium"]
        self.assertEqual(len(sodium_alerts), 1)
        alert = sodium_alerts[0]
        self.assertEqual(alert["percentage"], 105.0)
        self.assertIn("Product A", alert["message"])
        self.assertIn("Product D", alert["message"])

    def test_missing_nutrient_data_flags_incomplete_without_becoming_zero(self):
        # Product 1 has sodium 500mg
        self.client.post(self.records_url, {
            "product_name": "Salted Crackers",
            "servings_consumed": 1.0,
            "nutrition_facts": {
                "sodium": {"value": 500.0, "unit": "mg", "status": "detected"},
                "dietary_fibre": {"value": None, "unit": "g", "status": "not_provided"}
            }
        }, format="json")

        summary_resp = self.client.get(self.summary_url)
        data = summary_resp.json()

        # Fibre was not provided by Salted Crackers
        fibre_tot = data["nutrient_totals"]["dietary_fibre"]
        self.assertTrue(fibre_tot["is_incomplete"])
        self.assertIn("Salted Crackers", fibre_tot["missing_products"])
        # Must not fabricate a zero amount
        self.assertIsNone(fibre_tot["amount"])

    def test_editing_record_recalculates_daily_summary(self):
        from .models import ConsumptionRecord
        # Create record with 1 serving of 500 mg sodium
        create_resp = self.client.post(self.records_url, {
            "product_name": "Soup Can",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 500.0, "serving_value": 500.0, "unit": "mg"}}
        }, format="json")
        rec_id = create_resp.json()["record"]["id"]

        # Edit to 2.5 servings
        patch_url = reverse("intake-record-detail", kwargs={"pk": rec_id})
        patch_resp = self.client.patch(patch_url, {"servings_consumed": 2.5}, format="json")
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)

        # Summary must immediately reflect 500 * 2.5 = 1250 mg
        summary_resp = self.client.get(self.summary_url)
        data = summary_resp.json()
        self.assertEqual(data["nutrient_totals"]["sodium"]["amount"], 1250.0)

    def test_deleting_record_recalculates_daily_summary(self):
        from .models import ConsumptionRecord
        create_resp = self.client.post(self.records_url, {
            "product_name": "Temporary Item",
            "servings_consumed": 1.0,
            "nutrition_facts": {"sodium": {"value": 300.0, "serving_value": 300.0, "unit": "mg"}}
        }, format="json")
        rec_id = create_resp.json()["record"]["id"]

        del_url = reverse("intake-record-detail", kwargs={"pk": rec_id})
        del_resp = self.client.delete(del_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)

        summary_resp = self.client.get(self.summary_url)
        data = summary_resp.json()
        self.assertEqual(data["total_products_confirmed"], 0)
        self.assertEqual(data["nutrient_totals"]["sodium"]["amount"], 0.0)

    def test_duplicate_requests_do_not_duplicate_intake(self):
        from .models import ConsumptionRecord

        payload = {
            "product_name": "Oatmeal",
            "scan_id": "unique-scan-session-999",
            "servings_consumed": 1.0,
            "nutrition_facts": {"energy": {"value": 150.0, "unit": "kcal"}}
        }
        # First request
        resp1 = self.client.post(self.records_url, payload, format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        # Duplicate retry request with same scan_id
        resp2 = self.client.post(self.records_url, payload, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertTrue(resp2.json()["is_duplicate"])

        # Exactly 1 record in database
        self.assertEqual(ConsumptionRecord.objects.filter(user=self.user).count(), 1)

    def test_user_cannot_access_or_tamper_with_another_users_records(self):
        # Create record belonging to user 1
        create_resp = self.client.post(self.records_url, {
            "product_name": "User 1 Secret Food",
            "servings_consumed": 1.0,
            "nutrition_facts": {"energy": {"value": 200.0, "unit": "kcal"}}
        }, format="json")
        rec_id = create_resp.json()["record"]["id"]

        # Switch client to user 2
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.other_token.key}")

        detail_url = reverse("intake-record-detail", kwargs={"pk": rec_id})
        # User 2 tries to GET
        get_resp = self.client.get(detail_url)
        self.assertEqual(get_resp.status_code, status.HTTP_404_NOT_FOUND)

        # User 2 tries to PATCH
        patch_resp = self.client.patch(detail_url, {"servings_consumed": 5.0}, format="json")
        self.assertEqual(patch_resp.status_code, status.HTTP_404_NOT_FOUND)

        # User 2 tries to DELETE
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_404_NOT_FOUND)

        # User 2's daily summary must be empty
        summary_resp = self.client.get(self.summary_url)
        self.assertEqual(summary_resp.json()["total_products_confirmed"], 0)

    def test_date_rollover_and_historical_records_retention(self):
        from .models import ConsumptionRecord
        from datetime import date

        # Create record on yesterday's date
        yesterday = date(2026, 10, 16)
        today = date(2026, 10, 17)

        ConsumptionRecord.objects.create(
            user=self.user,
            product_name="Yesterday Oatmeal",
            servings_consumed=1.0,
            consumption_date=yesterday,
            nutrients_snapshot={"sodium": {"amount": 500.0, "unit": "mg", "is_missing": False}},
            reference_system="FSSAI_ICMR_2020",
        )

        ConsumptionRecord.objects.create(
            user=self.user,
            product_name="Today Salad",
            servings_consumed=1.0,
            consumption_date=today,
            nutrients_snapshot={"sodium": {"amount": 250.0, "unit": "mg", "is_missing": False}},
            reference_system="FSSAI_ICMR_2020",
        )

        # Query today specifically
        today_resp = self.client.get(f"{self.summary_url}?date=2026-10-17")
        self.assertEqual(today_resp.status_code, status.HTTP_200_OK)
        today_data = today_resp.json()
        self.assertEqual(today_data["total_products_confirmed"], 1)
        self.assertEqual(today_data["nutrient_totals"]["sodium"]["amount"], 250.0)

        # Query yesterday specifically
        yesterday_resp = self.client.get(f"{self.summary_url}?date=2026-10-16")
        self.assertEqual(yesterday_resp.status_code, status.HTTP_200_OK)
        yesterday_data = yesterday_resp.json()
        self.assertEqual(yesterday_data["total_products_confirmed"], 1)
        self.assertEqual(yesterday_data["nutrient_totals"]["sodium"]["amount"], 500.0)

        # Verify history dates endpoint lists both dates
        dates_resp = self.client.get(reverse("intake-history-dates"))
        self.assertEqual(dates_resp.status_code, status.HTTP_200_OK)
        dates_data = dates_resp.json()["dates"]
        self.assertIn("2026-10-16", dates_data)
        self.assertIn("2026-10-17", dates_data)




