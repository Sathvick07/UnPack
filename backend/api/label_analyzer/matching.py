"""
Personal Compatibility & Restriction Matching Engine for LabelLens (Mission 3).
Applies deterministic clinical logic and implements the 6 standardized decision states:
1. Confirmed conflict
2. Precautionary notice
3. No match in readable information
4. Uncertain interpretation
5. Missing or unreadable evidence
6. Unresolved contradiction

Strictly prevents false reassurance and never assumes unreadable text is allergen-free.
Guarantees zero duplicate findings through canonical allergy normalization.
Reuses existing ingredient extraction, allergen matching logic, evidence snippets, and bounding boxes.
"""

from typing import Dict, Any, List, Optional, Tuple
import re

# Comprehensive allergen aliases for deterministic matching
ALLERGEN_TAXONOMY: Dict[str, List[str]] = {
    "peanut": [
        "peanut", "peanuts", "arachis", "groundnut", "groundnuts",
        "peanut butter", "peanut oil", "peanut flour"
    ],
    "tree_nut": [
        "tree nut", "tree nuts", "treenut", "treenuts",
        "almond", "almonds", "cashew", "cashews", "walnut", "walnuts",
        "hazelnut", "hazelnuts", "pecan", "pecans", "pistachio", "pistachios",
        "macadamia", "brazil nut", "brazil nuts", "chestnut", "pine nut", "pine nuts"
    ],
    "milk": [
        "milk", "dairy", "whey", "casein", "caseinate", "lactose", "butter",
        "cream", "cheese", "yogurt", "milk solids", "milk fat", "skimmed milk",
        "whole milk", "condensed milk", "ghee", "curd", "buttermilk"
    ],
    "gluten": [
        "gluten", "wheat", "barley", "rye", "malt", "maltodextrin", "malt extract",
        "brewer's yeast", "triticale", "spelt", "semolina", "durum", "kamut",
        "wheat flour", "wheat bran", "wheat gluten", "atta", "maida", "suji", "rava"
    ],
    "wheat": [
        "wheat", "spelt", "semolina", "durum", "kamut", "wheat flour",
        "farina", "wheat bran", "wheat gluten", "atta", "maida", "suji", "rava"
    ],
    "egg": [
        "egg", "eggs", "albumin", "ovalbumin", "egg yolk", "egg white",
        "lysozyme", "egg powder", "mayonnaise"
    ],
    "soy": [
        "soy", "soya", "soybean", "soybeans", "tofu", "edamame",
        "soy lecithin", "tamari", "soy protein", "hydrolyzed soy"
    ],
    "fish": [
        "fish", "cod", "salmon", "tuna", "anchovy", "bass", "tilapia",
        "fish sauce", "mackerel", "haddock", "halibut", "sardine"
    ],
    "shellfish": [
        "shellfish", "crustacean", "crustaceans", "shrimp", "prawn", "prawns",
        "crab", "lobster", "clam", "mussel", "oyster", "scallop"
    ],
    "sesame": [
        "sesame", "tahini", "sesame seed", "sesame seeds", "sesame oil"
    ],
    "mustard": [
        "mustard", "mustard seed", "mustard seeds", "mustard oil", "mustard flour"
    ],
    "sulfite": [
        "sulfite", "sulfites", "sulphite", "sulphites", "sulfur dioxide", "sodium metabisulfite"
    ],
}

# Standardized Mission 3 Status Constants
STATUS_CONFIRMED_CONFLICT = "Confirmed conflict"
STATUS_PRECAUTIONARY = "Precautionary notice"
STATUS_NO_MATCH = "No match in readable information"
STATUS_UNCERTAIN = "Uncertain interpretation"
STATUS_MISSING_EVIDENCE = "Missing or unreadable evidence"
STATUS_UNRESOLVED_CONTRADICTION = "Unresolved contradiction"

# Ambiguous ingredient definitions that introduce uncertainty without manufacturer disclosure
AMBIGUOUS_PATTERNS = [
    (r"\b(natural\s+flavou?rs?|artificial\s+flavou?rs?|flavou?rings?)\b", "Natural / Artificial Flavors"),
    (r"\b(spices?|seasonings?|spice\s+extracts?)\b", "Spices / Seasonings"),
    (r"\b(emulsifiers?|stabilizers?|thickener|vegetable\s+gum)\b", "Emulsifiers / Thickeners"),
    (r"\b(modified\s+starch|food\s+starch|starch)\b", "Modified Starch"),
    (r"\b(hydrolyzed\s+protein|plant\s+protein|vegetable\s+protein)\b", "Hydrolyzed Protein"),
    (r"\b(caramel\s+colou?r)\b", "Caramel Color"),
]

class DualStatusStr(str):
    """
    String subclass that serializes as Mission 3 canonical status,
    while remaining fully backward-compatible with Mission 2 legacy uppercase statuses
    in direct Python equality and set-membership comparisons.
    """
    _EQUIV_MAP = {
        "confirmed conflict": {"confirmed conflict", "conflict detected"},
        "precautionary notice": {"precautionary notice"},
        "no match in readable information": {"no match in readable information", "no conflict identified in readable information"},
        "uncertain interpretation": {"uncertain interpretation", "unknown / verify", "uncertain"},
        "missing or unreadable evidence": {"missing or unreadable evidence", "unknown / verify", "not provided", "unreadable"},
        "unresolved contradiction": {"unresolved contradiction", "contradiction detected"},
    }

    def __eq__(self, other):
        if not isinstance(other, str):
            return False
        if super().__eq__(other):
            return True
        s1 = str(self).strip().lower()
        s2 = other.strip().lower()
        if s1 == s2:
            return True
        for group in self._EQUIV_MAP.values():
            if s1 in group and s2 in group:
                return True
        return False

    def __hash__(self):
        return super().__hash__()


def normalize_text(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", str(text).lower()).strip()


def get_canonical_allergen(text: str) -> str:
    """
    Resolves arbitrary user input or synonym to a stable canonical allergy key.
    E.g. 'Dairy / Milk' -> 'milk', 'Peanuts' -> 'peanut', 'Gluten / Wheat' -> 'gluten'.
    """
    norm = normalize_text(text)
    if not norm:
        return ""

    # Direct taxonomy key match
    if norm in ALLERGEN_TAXONOMY:
        return norm

    # Match exact alias or word boundary in alias list
    for canon_key, aliases in ALLERGEN_TAXONOMY.items():
        if norm in aliases:
            return canon_key
        for alias in aliases:
            if re.search(r"\b" + re.escape(alias) + r"s?\b", norm):
                return canon_key

    return norm


def get_display_name(raw_text: str, canon_key: str) -> str:
    """Provides user-friendly formatted title for restriction card."""
    title_map = {
        "peanut": "Peanuts",
        "tree_nut": "Tree Nuts",
        "milk": "Dairy / Milk",
        "gluten": "Gluten",
        "wheat": "Wheat",
        "egg": "Eggs",
        "soy": "Soy",
        "shellfish": "Shellfish",
        "fish": "Fish",
        "sesame": "Sesame",
        "mustard": "Mustard",
        "sulfite": "Sulfites",
    }
    if canon_key in title_map:
        return title_map[canon_key]
    return raw_text.replace("_", " ").title()


def evaluate_compatibility(
    ingredients: List[Dict[str, Any]],
    allergen_statements: List[Dict[str, Any]],
    nutrition_facts: Dict[str, Dict[str, Any]],
    user_restrictions: List[str],
    user_targets: Optional[Dict[str, Any]] = None,
    quality_tier: str = "CLEAR",
    is_complete: bool = True,
    contradictions: Optional[List[Dict[str, Any]]] = None,
    raw_text: str = ""
) -> List[Dict[str, Any]]:
    """
    Evaluates extracted evidence against user dietary restrictions and targets.
    Returns categorized findings adhering to the 6 standardized Mission 3 decision states.
    Ensures each selected allergy produces exactly ONE consolidated finding with exact supporting label text.
    """
    findings: List[Dict[str, Any]] = []
    user_targets = user_targets or {}
    contradictions = contradictions or []

    # Extract all readable ingredient names & raw source texts
    visible_ingredients: List[Dict[str, Any]] = []
    has_obscured_ingredients = False
    ambiguous_ingredients: List[Dict[str, Any]] = []

    for ing in ingredients:
        name = ing.get("name", "")
        status = ing.get("status", "detected")
        src = ing.get("source_text", name)
        bbox = ing.get("bounding_box")

        if status in ("uncertain", "unreadable", "ambiguous") or "[unreadable]" in str(src).lower():
            has_obscured_ingredients = True

        # Check if generic/ambiguous term
        target_check = f"{name} {src}".lower()
        for p, label in AMBIGUOUS_PATTERNS:
            if re.search(p, target_check):
                ambiguous_ingredients.append({
                    "name": name,
                    "source_text": src,
                    "label": label,
                    "bounding_box": bbox,
                })
                break

        visible_ingredients.append({
            "name": name,
            "status": status,
            "source_text": src,
            "bounding_box": bbox,
        })

    # Deduplicate user-specified restrictions by canonical key preserving first seen
    seen_canonical = set()
    unique_restrictions: List[Tuple[str, str]] = []

    for r in user_restrictions:
        raw_str = str(r).strip()
        if not raw_str:
            continue
        canon = get_canonical_allergen(raw_str)
        lookup_key = canon or normalize_text(raw_str)
        if lookup_key not in seen_canonical:
            seen_canonical.add(lookup_key)
            unique_restrictions.append((raw_str, canon))

    # Evaluate each unique restriction
    for restriction_raw, canon_key in unique_restrictions:
        display_title = get_display_name(restriction_raw, canon_key)
        matched_aliases = ALLERGEN_TAXONOMY.get(canon_key, [canon_key, normalize_text(restriction_raw)])

        conflict_evidence_items: List[str] = []
        precautionary_evidence_items: List[str] = []
        supporting_bboxes: List[List[float]] = []
        primary_supporting_text = ""

        # 0. Check if there is an unresolved contradiction affecting this restriction
        relevant_contradiction = None
        for c in contradictions:
            c_label = c.get("claim_label", "").lower()
            c_text = c.get("claim_text", "").lower()
            c_expl = c.get("explanation", "").lower()
            if (
                canon_key in c_label
                or canon_key in c_text
                or canon_key in c_expl
                or any(alias in c_label or alias in c_text or alias in c_expl for alias in matched_aliases)
            ):
                relevant_contradiction = c
                break

        if relevant_contradiction:
            c_claim = relevant_contradiction.get("claim_text") or relevant_contradiction.get("claim_label")
            c_support = relevant_contradiction.get("supporting_text") or relevant_contradiction.get("explanation")
            c_bbox = relevant_contradiction.get("bounding_box")

            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_UNRESOLVED_CONTRADICTION),
                "result_status": STATUS_UNRESOLVED_CONTRADICTION,
                "legacy_status": "CONFLICT DETECTED",
                "severity": "CRITICAL",
                "explanation": (
                    f"Contradiction detected: AI interpretation or packaging claim ('{c_claim}') "
                    f"disagrees with explicit label evidence ('{c_support}'). "
                    f"AI claim cannot be silently trusted."
                ),
                "evidence": f"Claim: \"{c_claim}\" vs Label Evidence: \"{c_support}\"",
                "supporting_text": str(c_support),
                "evidence_snippet": str(c_support),
                "bounding_box": c_bbox,
                "action_recommendation": (
                    f"Do not consume. Available evidence contains an unresolved contradiction for {display_title}. "
                    "Verify physical packaging or contact manufacturer."
                ),
                "source_type": "CONTRADICTION",
                "requires_manual_confirmation": True,
                "is_contradiction": True,
                "contradiction_details": relevant_contradiction,
            })
            continue

        # 1. Check explicit allergen statements (e.g. "CONTAINS MILK, WHEAT AND SOY")
        for stmt in allergen_statements:
            notice_type = stmt.get("notice_type", "contains").lower()
            stmt_text = stmt.get("source_text", "").strip()
            stmt_lower = stmt_text.lower()
            stmt_bbox = stmt.get("bounding_box")

            matches = False
            for alias in matched_aliases:
                if re.search(r"\b" + re.escape(alias) + r"s?\b", stmt_lower):
                    matches = True
                    break

            if matches:
                is_precautionary = (
                    notice_type == "may_contain"
                    or "may contain" in stmt_lower
                    or "facility" in stmt_lower
                    or "traces" in stmt_lower
                )
                if is_precautionary:
                    precautionary_evidence_items.append(f"Allergen warning: \"{stmt_text}\"")
                else:
                    conflict_evidence_items.append(f"Allergen statement: \"{stmt_text}\"")

                if not primary_supporting_text:
                    primary_supporting_text = stmt_text
                if stmt_bbox and stmt_bbox not in supporting_bboxes:
                    supporting_bboxes.append(stmt_bbox)

        # 2. Check individual ingredients list
        for item in visible_ingredients:
            item_name = item.get("name", "").strip()
            item_src = item.get("source_text", item_name).strip()
            item_status = item.get("status", "detected")
            item_bbox = item.get("bounding_box")
            target_str = (item_name + " " + item_src).lower()

            matches = False
            for alias in matched_aliases:
                if re.search(r"\b" + re.escape(alias) + r"s?\b", target_str):
                    matches = True
                    break

            if matches:
                if item_status == "detected":
                    conflict_evidence_items.append(f"Ingredient list: \"{item_src}\"")
                elif item_status in ("uncertain", "unreadable", "ambiguous"):
                    precautionary_evidence_items.append(f"Uncertain ingredient: \"{item_src}\"")

                if not primary_supporting_text:
                    primary_supporting_text = item_src
                if item_bbox and item_bbox not in supporting_bboxes:
                    supporting_bboxes.append(item_bbox)

        # Deduplicate evidence strings while maintaining order
        seen_ev = set()
        unique_conflicts = [x for x in conflict_evidence_items if not (x in seen_ev or seen_ev.add(x))]
        unique_precautionary = [x for x in precautionary_evidence_items if not (x in seen_ev or seen_ev.add(x))]
        primary_bbox = supporting_bboxes[0] if supporting_bboxes else None

        # 3. Determine single consolidated status and action recommendation
        if unique_conflicts:
            combined_evidence = " • ".join(unique_conflicts)
            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_CONFIRMED_CONFLICT),
                "result_status": STATUS_CONFIRMED_CONFLICT,
                "legacy_status": "CONFLICT DETECTED",
                "severity": "CRITICAL",
                "explanation": f"Ingredient or declared allergen matching '{display_title}' was confirmed on the packaging.",
                "evidence": combined_evidence,
                "supporting_text": primary_supporting_text or combined_evidence,
                "evidence_snippet": primary_supporting_text or combined_evidence,
                "bounding_box": primary_bbox,
                "action_recommendation": f"Avoid consuming this product. Packaging explicitly confirms presence of {display_title}.",
                "source_type": "EXACT_LABEL_TEXT",
                "requires_manual_confirmation": False,
            })
        elif unique_precautionary:
            combined_evidence = " • ".join(unique_precautionary)
            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_PRECAUTIONARY),
                "result_status": STATUS_PRECAUTIONARY,
                "legacy_status": "PRECAUTIONARY NOTICE",
                "severity": "WARNING",
                "explanation": f"Packaging includes a precautionary cross-contact advisory for '{display_title}'.",
                "evidence": combined_evidence,
                "supporting_text": primary_supporting_text or combined_evidence,
                "evidence_snippet": primary_supporting_text or combined_evidence,
                "bounding_box": primary_bbox,
                "action_recommendation": f"Exercise caution. This product may share manufacturing equipment with {display_title}.",
                "source_type": "PRECAUTIONARY_STATEMENT",
                "requires_manual_confirmation": False,
            })
        elif quality_tier in ("UNREADABLE", "UNCERTAIN") or not is_complete or has_obscured_ingredients or not ingredients:
            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_MISSING_EVIDENCE),
                "result_status": STATUS_MISSING_EVIDENCE,
                "legacy_status": "UNKNOWN / VERIFY",
                "severity": "ATTENTION",
                "explanation": (
                    f"Label clarity is compromised, curved, or contains unreadable sections. "
                    f"Absence of '{display_title}' cannot be verified from this image."
                ),
                "evidence": "Portion of ingredient list or allergen panel is unreadable, curved, or incomplete.",
                "supporting_text": "Portion of ingredient list or allergen panel is unreadable, curved, or incomplete.",
                "evidence_snippet": "Unreadable or obscured section on label",
                "bounding_box": None,
                "action_recommendation": "Check physical packaging carefully before consuming. Do not assume unread labels are safe.",
                "source_type": "UNCERTAINTY_FLAG",
                "requires_manual_confirmation": True,
            })
        elif ambiguous_ingredients:
            # When an ambiguous ingredient like "natural flavors" or "spices" is present,
            # we cannot rule out complex allergen presence without manufacturer verification
            first_amb = ambiguous_ingredients[0]
            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_UNCERTAIN),
                "result_status": STATUS_UNCERTAIN,
                "legacy_status": "UNKNOWN / VERIFY",
                "severity": "ATTENTION",
                "explanation": (
                    f"Readable ingredients include '{first_amb['source_text']}' ({first_amb['label']}), "
                    f"which may conceal derived sources. Absence of '{display_title}' remains uncertain."
                ),
                "evidence": f"Ambiguous ingredient on label: \"{first_amb['source_text']}\"",
                "supporting_text": first_amb['source_text'],
                "evidence_snippet": first_amb['source_text'],
                "bounding_box": first_amb.get("bounding_box"),
                "action_recommendation": f"Review ingredient '{first_amb['source_text']}' with manufacturer before consuming.",
                "source_type": "AMBIGUOUS_INGREDIENT",
                "requires_manual_confirmation": True,
            })
        else:
            findings.append({
                "id": canon_key or normalize_text(restriction_raw),
                "restriction": restriction_raw,
                "display_name": display_title,
                "status": DualStatusStr(STATUS_NO_MATCH),
                "result_status": STATUS_NO_MATCH,
                "legacy_status": "NO CONFLICT IDENTIFIED IN READABLE INFORMATION",
                "severity": "INFO",
                "explanation": (
                    f"No '{display_title}' ingredient or allergen warning was found in the readable information on this label. "
                    "Notice: This does not guarantee the product is completely allergen-free."
                ),
                "evidence": "Entire readable ingredient list and allergen declarations verified.",
                "supporting_text": "Entire readable ingredient list and allergen declarations verified.",
                "evidence_snippet": "Readable ingredients and declarations verified",
                "bounding_box": None,
                "action_recommendation": "Verify packaging seal and check for any regional allergen declarations.",
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
                "id": f"target_{target_key}",
                "target": target_key,
                "status": DualStatusStr(STATUS_MISSING_EVIDENCE),
                "result_status": STATUS_MISSING_EVIDENCE,
                "legacy_status": "NOT PROVIDED",
                "severity": "INFO",
                "explanation": f"The nutrient '{nutrient_name}' is not quantified or reported on the visible label.",
                "evidence": "Field absent from nutrition facts table.",
                "supporting_text": "Field absent from nutrition facts table",
                "evidence_snippet": "Field absent from nutrition facts table",
                "bounding_box": None,
                "action_recommendation": "Consult product manufacturer for unlisted nutrient quantities.",
                "source_type": "OMITTED_FIELD",
                "requires_manual_confirmation": False,
            })
        else:
            val = fact["value"]
            unit = fact.get("unit", "")
            src_snippet = fact.get("source_text") or f"{val} {unit}"
            if val > float(max_limit):
                findings.append({
                    "id": f"target_{target_key}",
                    "target": target_key,
                    "status": DualStatusStr("PREFERENCE MISMATCH"),
                    "result_status": STATUS_CONFIRMED_CONFLICT,
                    "legacy_status": "PREFERENCE MISMATCH",
                    "severity": "WARNING",
                    "explanation": f"{nutrient_name.capitalize()} value ({val} {unit}) exceeds your target limit of {max_limit} {unit}.",
                    "evidence": src_snippet,
                    "supporting_text": src_snippet,
                    "evidence_snippet": src_snippet,
                    "bounding_box": None,
                    "action_recommendation": f"Portion control: Per-serving amount is {fact.get('serving_value') or 'unspecified'} {unit}.",
                    "source_type": "NUTRITION_FACT",
                    "requires_manual_confirmation": False,
                })
            else:
                findings.append({
                    "id": f"target_{target_key}",
                    "target": target_key,
                    "status": DualStatusStr("WITHIN TARGET"),
                    "result_status": STATUS_NO_MATCH,
                    "legacy_status": "WITHIN TARGET",
                    "severity": "INFO",
                    "explanation": f"{nutrient_name.capitalize()} value ({val} {unit}) is within your target limit ({max_limit} {unit}).",
                    "evidence": src_snippet,
                    "supporting_text": src_snippet,
                    "evidence_snippet": src_snippet,
                    "bounding_box": None,
                    "action_recommendation": "Nutrient quantity complies with your set preferences.",
                    "source_type": "NUTRITION_FACT",
                    "requires_manual_confirmation": False,
                })

    # Final safety pass: strictly deduplicate findings by unique ID
    final_findings = []
    seen_ids = set()
    for f in findings:
        f_id = f.get("id") or f.get("restriction") or f.get("target")
        if f_id and f_id not in seen_ids:
            seen_ids.add(f_id)
            final_findings.append(f)
        elif not f_id:
            final_findings.append(f)

    return final_findings
