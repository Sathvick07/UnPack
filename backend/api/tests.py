import io
import os
import json
from PIL import Image, ImageDraw, ImageFilter
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
        # it MUST NOT claim "NO CONFLICT IDENTIFIED"! It must report UNKNOWN / VERIFY
        peanut_finding = [f for f in data["findings"] if f.get("restriction") == "peanut"][0]
        self.assertEqual(peanut_finding["status"], "UNKNOWN / VERIFY")
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
        self.assertEqual(milk_finding["status"], "CONFLICT DETECTED")
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
        self.assertEqual(gluten_finding["status"], "CONFLICT DETECTED")
        self.assertEqual(gluten_finding["severity"], "CRITICAL")
        self.assertIn("CONTAINS MILK, WHEAT AND SOY", gluten_finding["evidence"])

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
        self.assertEqual(peanut_finding["status"], "NO CONFLICT IDENTIFIED IN READABLE INFORMATION")
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



