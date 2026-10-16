"""
Personal Compatibility & Restriction Matching Engine for LabelLens.
Applies deterministic clinical logic and implements the 5 standardized decision states.
Prevents false reassurance and never assumes unreadable text is allergen-free.
"""

from typing import Dict, Any, List, Optional
import re

# Common allergen aliases for deterministic matching
ALLERGEN_TAXONOMY = {
    "peanut": ["peanut", "peanuts", "arachis", "groundnut", "peanut butter", "peanut oil"],
    "tree_nut": ["almond", "cashew", "walnut", "hazelnut", "pecan", "pistachio", "macadamia", "brazil nut"],
    "milk": ["milk", "dairy", "whey", "casein", "lactose", "butter", "cream", "cheese", "yogurt"],
    "egg": ["egg", "eggs", "albumin", "ovalbumin", "egg yolk", "egg white", "lysozyme"],
    "wheat": ["wheat", "spelt", "semolina", "durum", "kamut", "wheat flour", "farina"],
    "gluten": ["gluten", "wheat", "barley", "rye", "malt", "brewer's yeast"],
    "soy": ["soy", "soya", "soybean", "tofu", "edamame", "soy lecithin", "tamari"],
    "fish": ["fish", "cod", "salmon", "tuna", "anchovy", "bass", "tilapia", "fish sauce"],
    "shellfish": ["shellfish", "crustacean", "shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster"],
    "sesame": ["sesame", "tahini", "sesame seed", "sesame oil"],
}

def normalize_text(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text.lower()).strip()

def evaluate_compatibility(
    ingredients: List[Dict[str, Any]],
    allergen_statements: List[Dict[str, Any]],
    nutrition_facts: Dict[str, Dict[str, Any]],
    user_restrictions: List[str],
    user_targets: Optional[Dict[str, Any]] = None,
    quality_tier: str = "CLEAR",
    is_complete: bool = True
) -> List[Dict[str, Any]]:
    """
    Evaluates extracted evidence against user dietary restrictions and targets.
    Returns categorized findings adhering to the 5 standardized status states.
    """
    findings: List[Dict[str, Any]] = []
    user_targets = user_targets or {}

    # Extract all visible readable ingredient names & raw source texts
    visible_ingredients = []
    has_obscured_ingredients = False

    for ing in ingredients:
        name = ing.get("name", "")
        status = ing.get("status", "detected")
        src = ing.get("source_text", name)
        
        if status in ("uncertain", "unreadable", "ambiguous") or "[unreadable]" in src.lower():
            has_obscured_ingredients = True

        visible_ingredients.append({
            "name": name,
            "status": status,
            "source_text": src,
            "bounding_box": ing.get("bounding_box"),
        })

    # Evaluate each user-specified restriction
    for restriction_raw in user_restrictions:
        restriction_norm = normalize_text(restriction_raw)
        matched_aliases = ALLERGEN_TAXONOMY.get(restriction_norm, [restriction_norm])

        conflict_found = False
        precautionary_found = False
        conflict_evidence = None
        precautionary_evidence = None

        # 1. Check explicit allergen "contains" declarations
        for stmt in allergen_statements:
            notice_type = stmt.get("notice_type", "contains").lower()
            stmt_text = stmt.get("source_text", "").lower()
            
            for alias in matched_aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", stmt_text):
                    if notice_type == "contains":
                        conflict_found = True
                        conflict_evidence = stmt.get("source_text")
                        break
                    elif notice_type == "may_contain":
                        precautionary_found = True
                        precautionary_evidence = stmt.get("source_text")

            if conflict_found:
                break

        # 2. Check individual ingredients list if no explicit statement found yet
        if not conflict_found:
            for item in visible_ingredients:
                item_name = item["name"].lower()
                item_src = item["source_text"].lower()

                for alias in matched_aliases:
                    if re.search(r"\b" + re.escape(alias) + r"\b", item_name) or re.search(r"\b" + re.escape(alias) + r"\b", item_src):
                        if item["status"] == "detected":
                            conflict_found = True
                            conflict_evidence = item["source_text"]
                            break
                if conflict_found:
                    break

        # 3. Assign standardized status based on findings & quality tier
        if conflict_found:
            findings.append({
                "restriction": restriction_raw,
                "status": "CONFLICT DETECTED",
                "severity": "CRITICAL",
                "explanation": f"Ingredient matching '{restriction_raw}' was found on the label.",
                "evidence": conflict_evidence,
                "source_type": "EXACT_LABEL_TEXT",
                "requires_manual_confirmation": False,
            })
        elif precautionary_found:
            findings.append({
                "restriction": restriction_raw,
                "status": "PRECAUTIONARY NOTICE",
                "severity": "WARNING",
                "explanation": f"Manufacturer label includes a precautionary facility warning for '{restriction_raw}'.",
                "evidence": precautionary_evidence,
                "source_type": "PRECAUTIONARY_STATEMENT",
                "requires_manual_confirmation": False,
            })
        elif quality_tier in ("UNREADABLE", "LOW") or not is_complete or has_obscured_ingredients:
            # Crucial rule: Never assume allergen-free when label was unclear or incomplete!
            findings.append({
                "restriction": restriction_raw,
                "status": "UNKNOWN / VERIFY",
                "severity": "ATTENTION",
                "explanation": (
                    f"Label clarity is compromised or contains unreadable text. "
                    f"Absence of '{restriction_raw}' cannot be verified from this image."
                ),
                "evidence": "Portion of ingredient list is obscured, blurry, or cropped.",
                "source_type": "UNCERTAINTY_FLAG",
                "requires_manual_confirmation": True,
            })
        else:
            findings.append({
                "restriction": restriction_raw,
                "status": "NO CONFLICT IDENTIFIED IN READABLE INFORMATION",
                "severity": "INFO",
                "explanation": (
                    f"No '{restriction_raw}' ingredient was found in the readable ingredients list. "
                    "Notice: This does not guarantee the product is completely allergen-free."
                ),
                "evidence": "Entire readable ingredient list verified.",
                "source_type": "NEGATIVE_CONFIRMATION",
                "requires_manual_confirmation": False,
            })

    # Evaluate nutrition targets (e.g. sodium limit, sugar limit)
    for target_key, max_limit in user_targets.items():
        if not target_key.endswith("_max"):
            continue
        nutrient_name = target_key.replace("_max", "").lower()
        fact = nutrition_facts.get(nutrient_name)

        if not fact or fact.get("value") is None:
            findings.append({
                "target": target_key,
                "status": "NOT PROVIDED",
                "severity": "INFO",
                "explanation": f"The nutrient '{nutrient_name}' is not quantified or reported on the visible label.",
                "evidence": "Field absent from nutrition facts table.",
                "source_type": "OMITTED_FIELD",
                "requires_manual_confirmation": False,
            })
        else:
            val = fact["value"]
            unit = fact.get("unit", "")
            if val > float(max_limit):
                findings.append({
                    "target": target_key,
                    "status": "PREFERENCE MISMATCH",
                    "severity": "WARNING",
                    "explanation": f"{nutrient_name.capitalize()} value ({val} {unit}) exceeds your target limit of {max_limit} {unit}.",
                    "evidence": fact.get("source_text") or f"{val} {unit}",
                    "source_type": "NUTRITION_FACT",
                    "requires_manual_confirmation": False,
                })
            else:
                findings.append({
                    "target": target_key,
                    "status": "WITHIN TARGET",
                    "severity": "INFO",
                    "explanation": f"{nutrient_name.capitalize()} value ({val} {unit}) is within your target limit ({max_limit} {unit}).",
                    "evidence": fact.get("source_text") or f"{val} {unit}",
                    "source_type": "NUTRITION_FACT",
                    "requires_manual_confirmation": False,
                })

    return findings
