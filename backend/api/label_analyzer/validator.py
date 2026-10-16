"""
Evidence & Uncertainty Validator for LabelLens.
Validates extracted structured data, normalizes nutrients, preserves exact source text,
and strictly enforces that missing data is marked unknown/not-provided rather than zero.
"""

import re
from typing import Dict, Any, List, Optional

VALID_STATUSES = {
    "detected",
    "uncertain",
    "unreadable",
    "not_provided",
    "ambiguous",
    "needs_review",
    "unknown",
}

VALID_BASES = {
    "per_100g",
    "per_100ml",
    "per_serving",
    "per_package",
    "unknown",
}

def validate_ingredient_entry(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates a single ingredient item and guarantees source text preservation.
    """
    name = str(item.get("name", "")).strip()
    source_text = str(item.get("source_text", "")).strip() or name
    status = str(item.get("status", "detected")).lower()
    if status not in VALID_STATUSES:
        status = "uncertain"

    confidence = float(item.get("confidence", 0.9 if status == "detected" else 0.4))
    bounding_box = item.get("bounding_box", None)

    return {
        "name": name,
        "source_text": source_text,
        "status": status,
        "confidence": confidence,
        "bounding_box": bounding_box,
        "notes": item.get("notes", ""),
    }

def validate_nutrition_fact(nutrient_name: str, fact: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates a nutrition fact entry. Strictly distinguishes 0.0 (explicitly stated on label)
    from None / null (not provided or unreadable), and separates per-100g from per-serving values.
    """
    raw_val = fact.get("value")
    value: Optional[float] = None
    if raw_val is not None:
        try:
            value = round(float(raw_val), 2)
        except (ValueError, TypeError):
            value = None

    raw_serving = fact.get("serving_value")
    serving_value: Optional[float] = None
    if raw_serving is not None:
        try:
            serving_value = round(float(raw_serving), 2)
        except (ValueError, TypeError):
            serving_value = None

    status = str(fact.get("status", "detected" if value is not None else "not_provided")).lower()
    if status not in VALID_STATUSES:
        status = "uncertain"

    unit = str(fact.get("unit", "")).strip() or ("kcal" if nutrient_name.lower() in ("energy", "calories") else "g")
    basis = str(fact.get("basis", "per_100g")).lower()
    if basis not in VALID_BASES:
        basis = "unknown"

    serving_basis = str(fact.get("serving_basis", "per_serving" if serving_value is not None else "")).lower()

    source_text = str(fact.get("source_text", "")).strip()

    return {
        "nutrient": nutrient_name,
        "value": value,
        "unit": unit,
        "basis": basis,
        "serving_value": serving_value,
        "serving_basis": serving_basis,
        "status": status,
        "source_text": source_text,
        "is_zero_explicit": (value == 0.0 and bool(source_text)),
    }

def validate_extraction_completeness(
    raw_text: str,
    ingredients: List[Dict[str, Any]],
    nutrition_facts: Dict[str, Dict[str, Any]],
    quality_tier: str
) -> Dict[str, Any]:
    """
    Evaluates whether the extracted label information appears complete, truncated, or partly unreadable.
    """
    flags: List[str] = []
    is_incomplete = False

    raw_clean = raw_text.strip().lower()

    # Check for trailing ellipsis or unfinished ingredients
    if raw_clean.endswith("...") or raw_clean.endswith(",") or raw_clean.endswith("and") or "..." in raw_clean:
        flags.append("Ingredient list appears cut off or truncated at the image margin.")
        is_incomplete = True

    # Check for unreadable placeholders
    if "[unreadable]" in raw_clean or "[obscured]" in raw_clean or "???" in raw_clean:
        flags.append("One or more words could not be legibly resolved due to glare, fold, or blur.")
        is_incomplete = True

    # Check for missing allergen statement
    has_allergen_stmt = bool(re.search(r"(?:contains|allergens?|may contain):", raw_clean))
    if not has_allergen_stmt and len(ingredients) > 0:
        flags.append("No explicit allergen statement ('Contains' or 'May Contain') was identified on this label panel.")

    # Check if any ingredient is marked unreadable or uncertain
    if any(ing.get("status") in ("uncertain", "unreadable", "ambiguous") for ing in ingredients):
        flags.append("One or more ingredient entries contain obscured or uncertain text.")
        is_incomplete = True

    if quality_tier in ("LOW", "UNREADABLE", "UNCERTAIN"):
        flags.append("Image quality is below threshold; unlisted ingredients cannot be assumed absent.")
        is_incomplete = True

    # Check if core nutrition facts are present
    core_nutrients = ["energy", "fat", "carbohydrates", "protein"]
    missing_core = [n for n in core_nutrients if n not in nutrition_facts or nutrition_facts[n].get("value") is None]
    if missing_core:
        flags.append(f"Nutrition table is missing core declared fields: {', '.join(missing_core)}.")

    return {
        "is_complete": not is_incomplete,
        "completeness_score": 100 if not is_incomplete else (50 if quality_tier != 'UNREADABLE' else 20),
        "uncertainty_flags": flags,
    }
