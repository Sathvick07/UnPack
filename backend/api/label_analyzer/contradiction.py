"""
Contradiction Detection Engine for LabelLens (Mission 3).
Detects disagreements between AI interpretations/marketing claims and explicit label text.
Strictly prevents silently trusting AI claims when source text contradicts them.
Marks disagreements as unresolved contradictions when evidence cannot settle them.
Never invents evidence, ingredients, or nutrition values.
"""

import re
from typing import Dict, Any, List, Optional

# Standard marketing / AI claim patterns mapped to allergens and nutrients
CLAIM_PATTERNS = {
    "gluten_free": {
        "claim_regex": r"\b(gluten[\s\-]free|no\s+gluten|zero\s+gluten|without\s+gluten)\b",
        "contradicting_ingredients": [
            "wheat", "barley", "rye", "malt", "maltodextrin", "wheat flour",
            "semolina", "spelt", "durum", "atta", "maida", "suji", "rava", "triticale"
        ],
        "contradicting_allergen": "gluten",
        "claim_label": "Gluten-Free",
    },
    "dairy_free": {
        "claim_regex": r"\b(dairy[\s\-]free|non[\s\-]dairy|milk[\s\-]free|no\s+dairy|no\s+milk|100%\s+vegan|vegan)\b",
        "contradicting_ingredients": [
            "milk", "dairy", "whey", "casein", "caseinate", "lactose", "butter",
            "cream", "cheese", "yogurt", "milk solids", "milk fat", "ghee", "curd"
        ],
        "contradicting_allergen": "milk",
        "claim_label": "Dairy-Free / Vegan",
    },
    "nut_free": {
        "claim_regex": r"\b(nut[\s\-]free|peanut[\s\-]free|no\s+nuts|no\s+peanuts|tree\s+nut\s+free)\b",
        "contradicting_ingredients": [
            "peanut", "peanuts", "groundnut", "almond", "cashew", "walnut",
            "hazelnut", "pecan", "pistachio", "macadamia"
        ],
        "contradicting_allergen": "peanut",
        "claim_label": "Nut-Free",
    },
    "sugar_free": {
        "claim_regex": r"\b(sugar[\s\-]free|zero\s+sugar|no\s+sugar|no\s+added\s+sugar|0g\s+sugar)\b",
        "contradicting_ingredients": [
            "sugar", "cane sugar", "brown sugar", "corn syrup", "glucose", "fructose",
            "sucrose", "dextrose", "maltose", "honey", "invert sugar"
        ],
        "nutrient_key": "sugars",
        "nutrient_threshold": 0.5,  # >0.5g violates sugar free claim
        "claim_label": "Sugar-Free / Zero Sugar",
    },
    "low_sodium": {
        "claim_regex": r"\b(low\s+sodium|low\s+salt|sodium[\s\-]free)\b",
        "nutrient_key": "sodium",
        "nutrient_threshold": 140.0,  # FDA definition: <= 140mg is low sodium
        "claim_label": "Low Sodium",
    },
    "fat_free": {
        "claim_regex": r"\b(fat[\s\-]free|zero\s+fat|no\s+fat|0g\s+fat)\b",
        "nutrient_key": "fat",
        "nutrient_threshold": 0.5,  # >0.5g violates fat free claim
        "claim_label": "Fat-Free",
    },
}

# Ambiguous ingredients that cannot be settled without manufacturer disclosure
AMBIGUOUS_INGREDIENT_PATTERNS = [
    (r"\b(natural\s+flavou?rs?|artificial\s+flavou?rs?|flavou?rings?)\b", "Flavorings / Natural Flavors", "May derive from animal, gluten, or nut sources"),
    (r"\b(spices?|seasonings?|spice\s+extracts?)\b", "Spices / Seasonings", "May conceal mustard, celery, or sesame without declaration"),
    (r"\b(emulsifiers?|stabilizers?|thickener|vegetable\s+gum)\b", "Emulsifiers / Thickeners", "Source botanical or animal origin not specified"),
    (r"\b(modified\s+starch|food\s+starch|starch)\b", "Modified Starch", "May derive from wheat or corn"),
    (r"\b(hydrolyzed\s+protein|plant\s+protein|vegetable\s+protein)\b", "Hydrolyzed Protein", "Botanical origin (soy, wheat, or pea) unspecified"),
    (r"\b(caramel\s+colou?r)\b", "Caramel Color", "May contain sulfites or wheat derivatives"),
]


def detect_contradictions(
    raw_text: str,
    ingredients: List[Dict[str, Any]],
    allergen_statements: List[Dict[str, Any]],
    nutrition_facts: Dict[str, Dict[str, Any]],
    ai_interpretation: Optional[Dict[str, Any]] = None,
    quality_tier: str = "CLEAR"
) -> List[Dict[str, Any]]:
    """
    Examines text, extracted fields, and AI claims for irreconcilable contradictions.
    Returns structured contradiction items with exact supporting label evidence.
    """
    contradictions: List[Dict[str, Any]] = []
    ai_interpretation = ai_interpretation or {}
    text_lower = raw_text.lower()

    # Normalize extracted ingredients list for fast substring / word boundary lookup
    ing_texts = []
    for ing in ingredients:
        name = ing.get("name", "")
        src = ing.get("source_text", name)
        bbox = ing.get("bounding_box")
        ing_texts.append({
            "name": name,
            "source_text": src,
            "text_lower": f"{name} {src}".lower(),
            "bounding_box": bbox,
        })

    # Normalize allergen statements
    stmt_texts = []
    for stmt in allergen_statements:
        src = str(stmt.get("source_text") or stmt.get("statement") or stmt.get("text") or "").strip()
        n_type = str(stmt.get("notice_type") or stmt.get("type") or "contains").lower()
        stmt_texts.append({
            "source_text": src,
            "text_lower": src.lower(),
            "notice_type": n_type,
            "bounding_box": stmt.get("bounding_box"),
        })

    # 1. Contradictions from packaging text marketing claims vs explicit ingredients / allergens
    for claim_id, spec in CLAIM_PATTERNS.items():
        claim_regex = spec["claim_regex"]
        claim_label = spec["claim_label"]
        claim_match = re.search(claim_regex, text_lower)

        # Also check if AI interpretation explicitly asserted this claim
        ai_claimed = False
        if ai_interpretation:
            # e.g. ai_interpretation = {"gluten_free": True} or {"claims": ["Gluten-Free"]}
            if ai_interpretation.get(claim_id) is True:
                ai_claimed = True
            claims_list = [str(c).lower() for c in ai_interpretation.get("claims", [])]
            if any(re.search(claim_regex, c) for c in claims_list):
                ai_claimed = True
            safe_for_list = [str(s).lower() for s in ai_interpretation.get("safe_for", [])]
            if spec.get("contradicting_allergen") in safe_for_list:
                ai_claimed = True

        if not claim_match and not ai_claimed:
            continue

        claim_source = claim_match.group(0) if claim_match else f"AI Claim: {claim_label}"

        # A. Check against explicit ingredients
        contradicting_ings = spec.get("contradicting_ingredients", [])
        for ing_item in ing_texts:
            for bad_ing in contradicting_ings:
                if re.search(r"\b" + re.escape(bad_ing) + r"s?\b", ing_item["text_lower"]):
                    contradictions.append({
                        "id": f"contradiction_{claim_id}_{bad_ing}",
                        "claim_type": claim_id,
                        "claim_label": claim_label,
                        "claim_text": claim_source,
                        "contradiction_type": "CLAIM_VS_INGREDIENT",
                        "status": "Unresolved contradiction",
                        "severity": "CRITICAL",
                        "supporting_text": ing_item["source_text"],
                        "bounding_box": ing_item.get("bounding_box"),
                        "explanation": (
                            f"Disagreement detected: Marketing or AI claim asserts '{claim_label}', "
                            f"but explicit ingredient list contains '{ing_item['source_text']}'."
                        ),
                        "recommendation": "Do not trust the marketing/AI claim. Physical ingredient declaration confirms presence.",
                    })
                    break

        # B. Check against explicit allergen statements
        bad_allergen = spec.get("contradicting_allergen")
        if bad_allergen:
            for stmt_item in stmt_texts:
                if bad_allergen in stmt_item["text_lower"] or any(
                    b in stmt_item["text_lower"] for b in contradicting_ings
                ):
                    contradictions.append({
                        "id": f"contradiction_allergen_{claim_id}_{bad_allergen}",
                        "claim_type": claim_id,
                        "claim_label": claim_label,
                        "claim_text": claim_source,
                        "contradiction_type": "CLAIM_VS_ALLERGEN_STATEMENT",
                        "status": "Unresolved contradiction",
                        "severity": "CRITICAL",
                        "supporting_text": stmt_item["source_text"],
                        "bounding_box": stmt_item.get("bounding_box"),
                        "explanation": (
                            f"Disagreement detected: Claim asserts '{claim_label}', but packaging allergen declaration "
                            f"explicitly warns: '{stmt_item['source_text']}'."
                        ),
                        "recommendation": "Avoid consuming. Explicit allergen panel overrides front-of-pack claims.",
                    })

        # C. Check against nutrition panel (e.g. Sugar-Free claim vs Sugars > 0.5g)
        nutr_key = spec.get("nutrient_key")
        if nutr_key and nutr_key in nutrition_facts:
            fact = nutrition_facts[nutr_key]
            val = fact.get("value")
            thresh = spec.get("nutrient_threshold", 0.0)
            if val is not None and val > thresh:
                src_nutr = fact.get("source_text") or f"{nutr_key} {val}{fact.get('unit', '')}"
                contradictions.append({
                    "id": f"contradiction_nutrient_{claim_id}_{nutr_key}",
                    "claim_type": claim_id,
                    "claim_label": claim_label,
                    "claim_text": claim_source,
                    "contradiction_type": "CLAIM_VS_NUTRITION_TABLE",
                    "status": "Unresolved contradiction",
                    "severity": "WARNING",
                    "supporting_text": src_nutr,
                    "bounding_box": None,
                    "explanation": (
                        f"Disagreement detected: Label or AI claims '{claim_label}', but verified nutrition table "
                        f"states {nutr_key.capitalize()} is {val} {fact.get('unit', '')} (exceeds {thresh} {fact.get('unit', '')} threshold)."
                    ),
                    "recommendation": "Follow the printed nutrition facts table rather than promotional front-of-pack wording.",
                })

    # 2. AI Direct Misinterpretation vs Explicit Label Text
    # Example: AI claimed allergen presence where packaging explicitly states "Peanut-Free Facility"
    # or AI claims "No allergens" when "CONTAINS: ..." is on packaging
    if ai_interpretation:
        ai_allergens_absent = ai_interpretation.get("allergens_absent", [])
        for absent_a in ai_allergens_absent:
            a_lower = str(absent_a).lower()
            for stmt_item in stmt_texts:
                if a_lower in stmt_item["text_lower"]:
                    contradictions.append({
                        "id": f"ai_misinterpretation_{a_lower}",
                        "claim_type": "ai_misinterpretation",
                        "claim_label": f"AI Asserts Absence of {absent_a}",
                        "claim_text": f"AI interpretation reported product is free from {absent_a}",
                        "contradiction_type": "AI_VS_SOURCE_TEXT",
                        "status": "Unresolved contradiction",
                        "severity": "CRITICAL",
                        "supporting_text": stmt_item["source_text"],
                        "bounding_box": stmt_item.get("bounding_box"),
                        "explanation": (
                            f"AI interpretation reported '{absent_a}' was absent, but explicit extracted label text "
                            f"clearly contains '{stmt_item['source_text']}'. AI interpretation rejected in favor of label evidence."
                        ),
                        "recommendation": "Never rely on AI summary when physical label text explicitly states allergen presence.",
                    })

        # Check if AI hallucinated values for missing nutrition fields
        ai_nutrition = ai_interpretation.get("nutrition_facts", {})
        for nut_k, nut_val in ai_nutrition.items():
            fact = nutrition_facts.get(nut_k, {})
            # If label fact is not_provided/unreadable, but AI generated a specific number
            if fact.get("status") in ("not_provided", "unreadable") and nut_val not in (None, "", "null"):
                contradictions.append({
                    "id": f"ai_hallucinated_nutrient_{nut_k}",
                    "claim_type": "ai_hallucinated_value",
                    "claim_label": f"AI Fabricated {nut_k.capitalize()}",
                    "claim_text": f"AI reported {nut_k}: {nut_val}",
                    "contradiction_type": "AI_FABRICATION_VS_EVIDENCE",
                    "status": "Unresolved contradiction",
                    "severity": "WARNING",
                    "supporting_text": "Field absent from packaging label",
                    "bounding_box": None,
                    "explanation": (
                        f"AI interpretation reported {nut_k} as {nut_val}, but this nutrient is completely absent "
                        f"from the readable packaging table. Model fabrication rejected."
                    ),
                    "recommendation": "Field left unverified (not provided) rather than adopting AI estimate.",
                })

    # Deduplicate contradictions by unique ID
    seen_ids = set()
    unique_contradictions = []
    for c in contradictions:
        cid = c.get("id")
        if cid and cid not in seen_ids:
            seen_ids.add(cid)
            unique_contradictions.append(c)

    return unique_contradictions


def identify_ambiguous_ingredients(ingredients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identifies vague, generic, or umbrella ingredient terms (e.g. 'natural flavors', 'spices')
    that cannot confirm or exclude allergens without manufacturer disclosure.
    """
    ambiguous_items: List[Dict[str, Any]] = []

    for ing in ingredients:
        name = ing.get("name", "")
        src = ing.get("source_text", name)
        target = f"{name} {src}".lower()

        for pattern, category, explanation in AMBIGUOUS_INGREDIENT_PATTERNS:
            if re.search(pattern, target):
                ambiguous_items.append({
                    "ingredient_name": name,
                    "source_text": src,
                    "category": category,
                    "explanation": explanation,
                    "bounding_box": ing.get("bounding_box"),
                    "status": "Uncertain interpretation",
                })
                break

    return ambiguous_items
