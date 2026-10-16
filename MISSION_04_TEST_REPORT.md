# Mission 04 — Testing and Validation Audit Report for UnPack / LabelLens

**Audit Timestamp:** 2026-10-17T05:00:00+05:30  
**Repository:** [https://github.com/Sathvick07/UnPack](https://github.com/Sathvick07/UnPack)  
**Branch:** `main`  
**Application Architecture:**  
- **Frontend:** React 18.3 + TypeScript 5.5 + Vite 5.4 + Vanilla Responsive CSS (Design Tokens, Grid, Flexbox)  
- **Backend:** Django 5.1 + Django REST Framework 3.15 + Python 3.13  
- **Vision & OCR Pipeline:** Hybrid Gemini Vision Multimodal Model (`gemini-2.5-flash` / `gemini-2.0-flash`) + Deterministic Multi-Tier Pattern Parsing Engine + OpenCV/Pillow Image Quality & Blur Assessor  

---

## 1. Project & Environment Details

| Component | Specification | Operational Status |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Home (64-bit) | Verified |
| **Python Environment** | Python 3.13.0 (Virtual environment: `.\backend\venv`) | Operational |
| **Node.js / NPM** | Node.js v20.x, NPM 10.x | Operational |
| **Backend Test Runner** | Django Test Framework with `APITestCase` / SQLite in-memory test database | 62/62 tests passing (100%) |
| **Frontend Production Build** | Vite production compilation (`tsc && vite build`) | Built in 705ms, 0 errors, 0 warnings |
| **Live Backend API** | `http://127.0.0.1:8000/api/analyze-label/` | Active |
| **Live Frontend Dev Server** | `http://localhost:5173/` | Active |

---

## 2. Test Setup & Input Descriptions

All three required scenarios were executed against the live application using actual physical food packaging captures, genuine image files, and calibrated network payloads. Every test artifact has been saved to the [`evidence/`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence) directory.

### Test Inputs & Evidence Files
1. **Test 1 — Clear Packaged Food Label (Physical Product):**
   - **Image File:** `WhatsApp Image 2026-10-16 at 7.46.26 PM.jpeg` (711,052 bytes)
   - **Packaging Description:** Commercial packaged potato chips with multi-column nutrition facts table, explicit packaging allergen declaration (`CONTAINS MILK, WHEAT AND SOY. MAY CONTAIN BARLEY.`), and cylindrical packaging curvature.
   - **Evidence JSON Output:** [`evidence/scenario_1_clear_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_1_clear_label_output.json)

2. **Test 2 — Partially Unreadable / Blurry Label (Physical Product):**
   - **Image File:** `blurr image.jpeg` (518,082 bytes)
   - **Packaging Description:** Actual physical camera photo with significant motion and optical defocus blur (Laplacian variance = 71.5, below 100 threshold).
   - **Evidence JSON Output:** [`evidence/scenario_2_blurry_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_2_blurry_label_output.json)

3. **Test 3 — Conflicting Marketing Claims, Ambiguous Ingredients, and Incomplete Nutrition (Constructed / Simulated Test Input):**
   - **Input Type:** Constructed packaging text payload submitted alongside image to systematically evaluate edge cases of marketing claim contradictions, ambiguous ingredient categorization, and external AI hallucination rejection.
   - **Packaging Claims Tested:** `"100% Gluten-Free"`, `"No Wheat Guaranteed"`, `"Zero Sugar"`.
   - **Explicit Ingredients Tested:** `"Rice Flour, Maida (Refined Wheat Flour), Sugar, Spices and Condiments, Natural Flavors, Emulsifiers"`.
   - **Explicit Allergen Notice:** `"CONTAINS: Wheat"`.
   - **Nutrition Table:** Declares `Total Sugars 14.5g / 100g`, `Total Fat 12.0g / 100g`, with `Trans Fat` and `Added Sugars` omitted from the label.
   - **Simulated External AI Input:** AI interpretation payload falsely claiming `trans_fat: 0.0` with assumption `"Assumed 0 because omitted"`.
   - **Evidence JSON Output:** [`evidence/scenario_3_conflict_and_ambiguity_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_3_conflict_and_ambiguity_output.json)

---

## 3. Test Cases & Execution Results

### Test 1 — Clear Label and Stated Preference

- **Scenario Objective:** Validate that a clear packaged-food label extracts text, matches user dietary preferences deterministically, flags conflicts with exact supporting packaging evidence, and grounds findings in physical packaging declarations.
- **Input Parameters:**
  - Image: `WhatsApp Image 2026-10-16 at 7.46.26 PM.jpeg`
  - Active Dietary Restrictions: `["gluten", "wheat", "peanut", "milk"]`
- **Expected Results:**
  - Quality score reflects clear/moderate tier with cylindrical curvature advisory;
  - Ingredients and allergen statements extracted with exact verbatim quotes;
  - `Dairy / Milk` flagged as `Confirmed conflict` (Severity: `CRITICAL`) with exact packaging evidence `CONTAINS MILK, WHEAT AND SOY.`;
  - `Wheat` and `Gluten` flagged as `Confirmed conflict` (Severity: `CRITICAL`) grounded in both the explicit allergen statement and ingredient list (`MAIDA (REFINED WHEAT FLOUR)`);
  - `Peanuts` flagged as `Uncertain interpretation` (Severity: `ATTENTION`) because peanuts are not declared, but an ambiguous ingredient blend (`*SPICES AND CONDIMENTS`) is present;
  - Every flagged finding contains exact verbatim supporting text quotes and actionable safety guidance.
- **Actual Results:**
  - **Readability Status:** `MODERATE` (Quality Score: 75/100; curvature warning: `"Curved cylindrical packaging surface detected. Text along the edges may be distorted or wrapped out of view."`).
  - **Extracted Ingredients:** 14 structured ingredient items.
  - **Extracted Allergen Statements:** 2 packaging declarations (`"CONTAINS MILK, WHEAT AND SOY."` and `"MAY CONTAIN BARLEY."`).
  - **Compatibility Findings:**
    1. **Dairy / Milk:** `Confirmed conflict` (Severity: `CRITICAL`). Exact Supporting Text: `"CONTAINS MILK, WHEAT AND SOY."`. Action Recommendation: `"Avoid consuming this product. Packaging explicitly confirms presence of Dairy / Milk."` Requires Manual Confirmation: `false`.
    2. **Gluten:** `Confirmed conflict` (Severity: `CRITICAL`). Exact Supporting Text: `"CONTAINS MILK, WHEAT AND SOY." • "MALTODEXTRIN" • "*SPICES AND CONDIMENTS (CONTAINING ONION POWDER, MAIDA (REFINED WHEAT FLOUR), BLACK SALT, CUMIN)"`. Action Recommendation: `"Avoid consuming this product. Packaging explicitly confirms presence of Gluten."` Requires Manual Confirmation: `false`.
    3. **Wheat:** `Confirmed conflict` (Severity: `CRITICAL`). Exact Supporting Text: `"CONTAINS MILK, WHEAT AND SOY." • "*SPICES AND CONDIMENTS (CONTAINING ONION POWDER, MAIDA (REFINED WHEAT FLOUR), BLACK SALT, CUMIN)"`. Action Recommendation: `"Avoid consuming this product. Packaging explicitly confirms presence of Wheat."` Requires Manual Confirmation: `false`.
    4. **Peanuts:** `Uncertain interpretation` (Severity: `ATTENTION`). Exact Supporting Text: `"*SPICES AND CONDIMENTS (CONTAINING ONION POWDER, MAIDA (REFINED WHEAT FLOUR), BLACK SALT, CUMIN)"`. Explanation: `"Readable ingredients include '*SPICES AND CONDIMENTS ...' (Spices / Seasonings), which may conceal derived sources. Absence of 'Peanuts' remains uncertain."` Action Recommendation: `"Review ingredient ... with manufacturer before consuming."` Requires Manual Confirmation: `true`.
  - **Evidence Grounding:** Every finding presents exact verbatim packaging quotes and actionable recommendations.
- **Pass/Fail Status:** **PASS**
- **Evidence Reference:** [`evidence/scenario_1_clear_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_1_clear_label_output.json)

---

### Test 2 — Partially Unreadable Label

- **Scenario Objective:** Validate that a blurry or degraded image does not produce false assurances, that unreadable text is not interpreted as "safe" or "absent", that image defects trigger appropriate retake prompts, and that manual confirmation is required.
- **Input Parameters:**
  - Image: `blurr image.jpeg`
  - Active Dietary Restrictions: `["peanut", "gluten", "milk"]`
- **Expected Results:**
  - Image quality assessor flags blurriness with Laplacian variance below threshold (< 100);
  - Quality tier set to `UNCERTAIN` (Score: 55/100);
  - System prompts user with clear retake recommendations;
  - `manual_confirmation_needed` flag set to `True`;
  - Unverified restricted ingredients (e.g., Peanuts) are classified strictly as `Missing or unreadable evidence` rather than assuming absence;
  - System refuses to present a "safe" guarantee badge under compromised visibility.
- **Actual Results:**
  - **Readability Status:** `UNCERTAIN`
  - **Clarity / Quality Score:** 55 / 100
  - **Blur Metric (Laplacian Variance):** `71.5` (Threshold: 100.0)
  - **Quality Warnings:** `["Image appears blurry. Please retake the photo with the label in focus."]`
  - **Retake Recommendations:** `["Ensure the camera lens is focused squarely on the nutrition panel and hold steady."]`
  - **Manual Confirmation Needed:** `True`
  - **Uncertainty Flags:**
    - `"Image appears blurry. Please retake the photo with the label in focus."`
    - `"Image quality is below threshold; unlisted ingredients cannot be assumed absent."`
  - **Peanut Finding:** Classified strictly as `Missing or unreadable evidence` (Severity: `ATTENTION`) with evidence explanation: `"Label clarity is compromised, curved, or contains unreadable sections. Absence of 'Peanuts' cannot be verified from this image."` Action recommendation: `"Check physical packaging carefully before consuming. Do not assume unread labels are safe."`
  - **Dairy / Milk & Gluten Findings:** Explicit text on readable portions is still cross-referenced (`"CONTAINS MILK, WHEAT AND SOY."`), correctly raising `Confirmed conflict` for milk and gluten.
  - **Safety Guarantee Protection:** Zero unsupported safety badges or false reassurances were displayed.
- **Pass/Fail Status:** **PASS**
- **Evidence Reference:** [`evidence/scenario_2_blurry_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_2_blurry_label_output.json)

---

### Test 3 — Conflicting or Incomplete Information (Constructed Input)

- **Scenario Objective:** Test ambiguous ingredient umbrella terms, incomplete nutrition panel data, front-of-pack marketing claims vs explicit packaging declarations, and simulated external AI hallucination rejection.
- **Input Parameters:**
  - Test Input Nature: **Simulated/Constructed Packaging Text Payload**
  - Conflicting Marketing Text: `"GLUTEN-FREE HEALTH CRACKERS. 100% Gluten-Free. No Wheat Guaranteed. Zero Sugar."`
  - Explicit Ingredients: `"Rice Flour, Maida (Refined Wheat Flour), Sugar, Spices and Condiments, Natural Flavors, Emulsifiers."`
  - Explicit Allergen Notice: `"CONTAINS: Wheat."`
  - Nutrition Panel: Energy 420 kcal, Total Sugars 14.5g, Total Fat 12.0g, Sodium 480mg (Trans Fat and Added Sugars omitted from label).
  - Simulated External AI Input: AI interpretation payload asserting `trans_fat: 0.0` with assumption `"Assumed 0 because omitted"`.
- **Expected Results:**
  - Contradiction 1: Marketing claim `"100% Gluten-Free"` contradicted by explicit ingredient `"Maida (Refined Wheat Flour)"` (`CLAIM_VS_INGREDIENT`, CRITICAL);
  - Contradiction 2: Marketing claim `"100% Gluten-Free"` contradicted by explicit packaging allergen warning `"CONTAINS: Wheat"` (`CLAIM_VS_ALLERGEN_STATEMENT`, CRITICAL);
  - Contradiction 3: Marketing claim `"Zero Sugar"` contradicted by explicit ingredient `"Sugar"` (`CLAIM_VS_INGREDIENT`, CRITICAL);
  - Contradiction 4: Marketing claim `"Zero Sugar"` contradicted by nutrition table declaring 14.5g Sugars (`CLAIM_VS_NUTRITION_TABLE`, WARNING);
  - Contradiction 5: External AI claim asserting `trans_fat: 0.0` rejected because trans fat is absent from label (`AI_FABRICATION_VS_EVIDENCE`, WARNING);
  - Ambiguous Ingredients: `"Spices and Condiments"`, `"Natural Flavors"`, and `"Emulsifiers"` detected and categorized as `Uncertain interpretation` with manufacturer consultation warnings;
  - Missing Nutrition Data: Trans Fat and Added Sugars recorded strictly as `value: null, status: "not_provided"`, never converted to `0.0`.
- **Actual Results:**
  - **Contradictions Detected:** 5 distinct contradictions identified:
    1. `[CLAIM_VS_INGREDIENT]` Claim: `'gluten-free'` vs Ingredient: `'Maida (Refined Wheat Flour)'` (Severity: `CRITICAL`). Explanation: `"Disagreement detected: Marketing or AI claim asserts 'Gluten-Free', but explicit ingredient list contains 'Maida (Refined Wheat Flour)'."`
    2. `[CLAIM_VS_ALLERGEN_STATEMENT]` Claim: `'gluten-free'` vs Packaging Statement: `'CONTAINS: Wheat'` (Severity: `CRITICAL`). Explanation: `"Disagreement detected: Claim asserts 'Gluten-Free', but packaging allergen declaration explicitly warns: 'CONTAINS: Wheat'."`
    3. `[CLAIM_VS_INGREDIENT]` Claim: `'zero sugar'` vs Ingredient: `'Sugar'` (Severity: `CRITICAL`). Explanation: `"Disagreement detected: Marketing or AI claim asserts 'Sugar-Free / Zero Sugar', but explicit ingredient list contains 'Sugar'."`
    4. `[CLAIM_VS_NUTRITION_TABLE]` Claim: `'zero sugar'` vs Table Value: `'Total Sugars (g) 14.5'` (Severity: `WARNING`). Explanation: `"Disagreement detected: Label or AI claims 'Sugar-Free / Zero Sugar', but verified nutrition table states Sugars is 14.5 (exceeds 0.5 threshold)."
    5. `[AI_FABRICATION_VS_EVIDENCE]` Claim: `'AI reported trans_fat: 0.0'` vs Table Evidence: `'Field absent from packaging label'` (Severity: `WARNING`). Explanation: `"AI interpretation reported trans_fat as {'value': 0.0, 'status': 'detected', 'note': 'Assumed 0 because omitted'}, but this nutrient is completely absent from the readable packaging table. Model fabrication rejected."`
  - **Ambiguous Ingredients Flagged:** 3 items categorized with specific risk explanations:
    1. `'Spices and Condiments'` (Spices / Seasonings): `"May conceal mustard, celery, or sesame without declaration"` (Status: `Uncertain interpretation`).
    2. `'Natural Flavors'` (Flavorings / Natural Flavors): `"May derive from animal, gluten, or nut sources"` (Status: `Uncertain interpretation`).
    3. `'Emulsifiers'` (Emulsifiers / Thickeners): `"Source botanical or animal origin not specified"` (Status: `Uncertain interpretation`).
  - **Nutrition Completeness Verification:**
    - `sugars`: `{ value: 14.5, unit: 'g', status: 'detected' }`
    - `trans_fat`: `{ value: null, unit: 'g', status: 'not_provided' }` (Preserved as `null`)
    - `added_sugars`: `{ value: null, unit: 'g', status: 'not_provided' }` (Preserved as `null`)
- **Pass/Fail Status:** **PASS**
- **Evidence Reference:** [`evidence/scenario_3_conflict_and_ambiguity_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_3_conflict_and_ambiguity_output.json)

---

## 4. Comprehensive Audit of the Nine Mission 04 Requirements

| Req # | Mission 04 Requirement Description | Implementation & Verification Summary | Status |
| :---: | :--- | :--- | :---: |
| **1** | **Clear label and stated dietary preference** | Verified in Test 1 using `WhatsApp Image 2026-10-16 at 7.46.26 PM.jpeg` and preferences `["gluten", "wheat", "peanut", "milk"]`. Deterministically classified all 4 restrictions with 100% accuracy. | **PASS** |
| **2** | **Supporting evidence for every flagged ingredient or nutrition value** | Every flagged allergen, nutrient, and contradiction contains verbatim packaging quotes (e.g. `"CONTAINS MILK, WHEAT AND SOY."`, `"Maida (Refined Wheat Flour)"`, `"Total Sugars (g) 14.5"`). | **PASS** |
| **3** | **Partially unreadable label** | Verified in Test 2 using `blurr image.jpeg`. Laplacian variance measured at 71.5 (< 100 threshold); quality tier assigned as `UNCERTAIN` with quality score 55/100. | **PASS** |
| **4** | **Clearer-image or manual-confirmation behavior** | When blur or curvature is detected, `manual_confirmation_needed` is set to `true`, and retake recommendations are delivered (`"Ensure the camera lens is focused squarely on the nutrition panel and hold steady."`). | **PASS** |
| **5** | **Conflicting or incomplete information** | Verified in Test 3 with front-of-pack claims (`"100% Gluten-Free"`, `"Zero Sugar"`) conflicting with ingredients (`Maida`, `Sugar`), allergen panel (`CONTAINS: Wheat`), and nutrition table (14.5g Sugars). | **PASS** |
| **6** | **Original source text, uncertainty, and confirmation** | Original source text is preserved verbatim across all findings; ambiguous ingredients (`"Spices and Condiments"`) require confirmation rather than assuming absence or guessing origin. | **PASS** |
| **7** | **No fabricated details or definitive unsupported safety guarantees** | External AI hallucinated trans-fat (`0.0`) was rejected via `AI_FABRICATION_VS_EVIDENCE` contradiction; omitted nutrients remain `null`/`not_provided`; degraded images never grant a false safety badge. | **PASS** |
| **8** | **Expected result, actual result, pass/fail status, and evidence for all three tests** | All three tests (Test 1, Test 2, Test 3) explicitly document expected results, actual results, pass/fail status, and direct clickable evidence links in Sections 2 and 3 above. | **PASS** |
| **9** | **False positives, missed information, defects, and improvements** | Thoroughly documented in Sections 5 and 6 below, including the investigation, root-cause analysis, and resolution of both defects discovered during the Mission 04 audit. | **PASS** |

---

## 5. False Positives & Missed Information Analysis

1. **Umbrella Term Precautionary Notices:**
   - *Observation:* Terms such as `"Spices and Condiments"` or `"Natural Seasoning"` trigger `Uncertain interpretation` (ATTENTION) for allergens like peanut, sesame, mustard, or celery.
   - *Clinical / Regulatory Assessment:* This is a deliberate, evidence-based safety precaution rather than a false positive. Food regulations in multiple jurisdictions (including FSSAI and FDA) allow composite spice blends up to 2% without individual sub-ingredient disclosure, which frequently harbors undeclared allergens or processing aids.
2. **Compound Sub-Ingredient Parentheses:**
   - *Observation:* Packaging ingredient declarations often nest parentheses (e.g. `SEASONING (SALT, RED CHILLI POWDER (0.4%), SPICES & CONDIMENTS, MAIDA (REFINED WHEAT FLOUR), BLACK SALT, ACIDITY REGULATORS (INS 330, INS 296))`).
   - *Assessment:* The regex splitter `re.split(r",\s*(?![^()]*\))", ...)` correctly maintains compound ingredient blocks intact without erroneously splitting nested sub-ingredients, avoiding fragmentation or lost context.

---

## 6. Defects Found & Improvements Made During Audit

### Defect 1: Lookahead Boundary Truncation Between Ingredients and Allergen Statement
- **Component:** [`backend/api/label_analyzer/ocr_engine.py`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/backend/api/label_analyzer/ocr_engine.py)
- **Symptom:** In labels where the ingredients block was immediately followed on the next line by an allergen statement (e.g. `Emulsifiers.\nCONTAINS: Wheat`), the lookahead regex did not recognize a single newline preceding `CONTAINS:` as a block boundary. As a result, the last ingredient was extracted as `Emulsifiers.\nCONTAINS: Wheat` rather than `Emulsifiers`.
- **Root Cause:** The lookahead regex `(?=\n\n|contains:?|...)` checked for double newlines `\n\n` but not single newlines `\n\s*(?:contains|may contain|allergens?):?`.
- **Resolution Applied:** Updated the lookahead pattern in `backend/api/label_analyzer/ocr_engine.py`:
  ```python
  ing_match = re.search(
      r"ingredients?:\s*([^\n\r]+(?:\n[^\n\r]+)*?)(?=\n\n|\n\s*(?:contains|may contain|allergens?|nutrition facts|nutritional information):?|contains:?|may contain:?|nutrition facts|nutritional information|allergens?:?|$)",
      text,
      re.IGNORECASE
  )
  ```
- **Verification:** Re-executed Scenario 3 and unit tests. The ingredient is now cleanly extracted as `'Emulsifiers'` and the allergen declaration `'CONTAINS: Wheat'` is parsed into its dedicated statement block.

---

### Defect 2: Explicit Milk Packaging Declaration Schema Normalization & False Missing-Allergen Warning
- **Component:** [`backend/api/label_analyzer/ocr_engine.py`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/backend/api/label_analyzer/ocr_engine.py), [`backend/api/label_analyzer/matching.py`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/backend/api/label_analyzer/matching.py), and [`backend/api/label_analyzer/validator.py`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/backend/api/label_analyzer/validator.py)
- **Symptom:** In Scenario 1, the physical label explicitly printed `CONTAINS MILK, WHEAT AND SOY.`, but Dairy / Milk was classified as `Uncertain interpretation` (ATTENTION) instead of `Confirmed conflict` (CRITICAL). Simultaneously, an uncertainty flag falsely asserted `"No explicit allergen statement ('Contains' or 'May Contain') was identified on this label panel."`
- **Root Cause:** 
  1. Multimodal Gemini Vision returned structured allergen statements using dictionary keys `{"type": "contains", "statement": "CONTAINS MILK, WHEAT AND SOY."}`. However, `matching.py` only checked `stmt.get("source_text", "")`. Because `source_text` was not populated on dicts passed directly from Gemini, `stmt_text` evaluated to `""`, causing explicit milk matching to be skipped. Milk then fell through to the generic ambiguous ingredient check (`*SPICES AND CONDIMENTS`), wrongly yielding `Uncertain interpretation`.
  2. `validator.py` tested `r"(?:contains|allergens?|may contain):"`, strictly requiring a colon `:`. Packaging text without a colon (such as `CONTAINS MILK, WHEAT AND SOY.`) was not recognized as an allergen statement.
- **Resolution Applied:**
  1. In `ocr_engine.py`, normalized all raw allergen statement dictionaries to ensure `source_text`, `statement`, `notice_type`, and `type` are consistently populated:
     ```python
     elif isinstance(item, dict):
         src_text = str(item.get("source_text") or item.get("statement") or item.get("text") or "").strip()
         n_type = str(item.get("notice_type") or item.get("type") or ("contains" if "contain" in src_text.lower() else "precautionary")).lower()
         allergen_statements.append({
             "notice_type": n_type,
             "type": n_type,
             "source_text": src_text,
             "statement": src_text,
             "bounding_box": item.get("bounding_box", [0.0, 0.0, 0.0, 0.0])
         })
     ```
  2. In `matching.py` and `contradiction.py`, added robust key fallbacks (`stmt.get("source_text") or stmt.get("statement") or stmt.get("text")`).
  3. In `validator.py`, updated `validate_extraction_completeness` to accept `allergen_statements` and test word boundary `\b(?:contains|allergens?|may contain)\b` without requiring a colon.
  4. Added regression test `test_explicit_milk_declaration_from_structured_and_unstructured_evidence` in `backend/api/tests.py`.
- **Verification:** Re-executed Scenario 1 live. Dairy / Milk is now classified as **`Confirmed conflict` (Severity: CRITICAL)** with exact grounded packaging quote `"CONTAINS MILK, WHEAT AND SOY."`. The false missing-allergen warning is eliminated. All 62 backend unit tests passed.

---

## 7. Automated Backend Test Results

**Command executed:**
```powershell
.\backend\venv\Scripts\python.exe backend/manage.py test api
```

**Real Command Output:**
```
Creating test database for alias 'default'...
Found 62 test(s).
System check identified no issues (0 silenced).
..............................................................
----------------------------------------------------------------------
Ran 62 tests in 12.083s

OK
Destroying test database for alias 'default'...
```

### Test Suite Distribution:
- **Image Quality & Blur Detection Tests:** 8 tests (Laplacian variance, clarity score, curvature detection, edge aspect ratios).
- **OCR & Extraction Integrity Tests:** 12 tests (exact source preservation, missing data distinguishing, per-100g vs per-serving separation).
- **Allergen & Restriction Matching Tests:** 15 tests (confirmed conflicts, explicit milk declaration, precautionary may-contain, ambiguous ingredients).
- **Contradiction Detection Tests:** 8 tests (claim vs ingredient, claim vs allergen statement, claim vs nutrition table, AI fabrication rejection).
- **Nutrient Reference Limits Tests:** 7 tests (FSSAI 2020 15 nutrients, unit conversions, unsupported percentage handling, alert thresholds).
- **Consumption Intake Ledger Tests:** 12 tests (explicit confirmation, portion multipliers, multi-product accumulation, date rollover, user isolation, idempotency).

**Overall Backend Test Result:** **62 / 62 PASS (100%)**

---

## 8. Frontend Production Build Results

**Command executed:**
```powershell
cmd /c "npm --prefix frontend run build"
```

**Real Command Output:**
```
> unpack-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 51 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.84 kB │ gzip:  0.96 kB
dist/assets/index-DeqgsL8_.css   71.02 kB │ gzip: 13.49 kB
dist/assets/index-B3L16xmu.js   267.27 kB │ gzip: 75.53 kB
✓ built in 705ms
```

**Overall Frontend Build Result:** **PASS (0 errors, 0 warnings)**

---

## 9. Captured Evidence Artifacts

The following genuine evidence files and screenshots have been generated and saved in the project repository:

1. **[`evidence/scenario_1_clear_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_1_clear_label_output.json):** Raw API JSON output for Scenario 1 (clear label with Dairy / Milk confirmed conflict).
2. **[`evidence/scenario_2_blurry_label_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_2_blurry_label_output.json):** Raw API JSON output for Scenario 2 (blurry label with uncertainty preservation).
3. **[`evidence/scenario_3_conflict_and_ambiguity_output.json`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scenario_3_conflict_and_ambiguity_output.json):** Raw API JSON output for Scenario 3 (marketing claim conflict, ambiguous ingredients, missing nutrition).
4. **[`evidence/home_1366x768.png`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/home_1366x768.png):** Headless Chrome screenshot of Home Page at Desktop resolution (1366x768).
5. **[`evidence/home_mobile_375x812.png`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/home_mobile_375x812.png):** Headless Chrome screenshot of Home Page at Mobile resolution (375x812).
6. **[`evidence/scan_desktop_1366x768.png`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scan_desktop_1366x768.png):** Headless Chrome screenshot of Scan Dashboard at Desktop resolution (1366x768).
7. **[`evidence/scan_mobile_375x812.png`](file:///c:/Users/sathv/OneDrive/Desktop/UnPack/evidence/scan_mobile_375x812.png):** Headless Chrome screenshot of Scan Dashboard at Mobile resolution (375x812).

---

## 10. Remaining Limitations & Recommended Next Steps

1. **Curvature De-warping:**
   - *Current State:* Curved cylindrical labels (e.g. cans, bottles) are accurately detected using aspect ratio and edge contrast metrics, with an explicit advisory warning shown to the user (`"Curved cylindrical packaging surface detected. Text along the edges may be distorted or wrapped out of view."`).
   - *Next Step:* Future versions could incorporate client-side panoramic stitching or multi-angle image capture for cylindrical packaging.
2. **External AI Network Contingency:**
   - *Current State:* If the external Gemini API is unreachable or rate-limited, the application deterministically falls back to its multi-tier regular-expression and keyword parsing pipeline without failing the user's request.
   - *Next Step:* Add on-device Tesseract or WebAssembly-based OCR fallback directly in the browser to enable offline processing.
3. **Volumetric Density Tracking:**
   - *Current State:* Safe mass-to-mass (`g` $\leftrightarrow$ `mg` $\leftrightarrow$ `mcg`) and energy (`kJ` $\leftrightarrow$ `kcal`) unit conversions are active. Volume (`ml`) is not automatically converted to mass (`g`) unless specific product density is stated on the label.

---

### Audit Sign-Off
All nine Mission 04 validation requirements have been audited and verified with complete integrity. The explicit milk declaration defect has been repaired and verified via automated regression testing and live scenario re-execution. All 62 backend tests pass, the frontend production bundle compiles cleanly with zero errors, and genuine evidence outputs are recorded on disk.

**Mission 04 Status: READY FOR SUBMISSION**
