"""
Centralized Daily Nutrient Reference Limits and Standards.

Reference System:
FSSAI (Food Safety and Standards Authority of India) - Food Safety and Standards
(Labelling and Display) Regulations, 2020, Schedule II (Daily Reference Values),
harmonized with ICMR-NIN (National Institute of Nutrition) 2020 Recommended Dietary Allowances (RDA).

Important Legal & Clinical Disclaimer:
These values represent standard population reference benchmarks established for food packaging
labels based on an average adult daily diet of 2,000 kcal (8,400 kJ). They are educational
references only and do NOT constitute individualized medical, clinical, or pediatric dietary advice.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class NutrientReference:
    key: str
    display_name: str
    daily_reference_amount: Optional[float]
    unit: str
    reference_system: str
    source_version: str
    supports_percentage: bool
    alert_threshold_pct: Optional[float]
    is_upper_limit: bool
    applicability_notes: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


REFERENCE_SYSTEM_NAME = "FSSAI_ICMR_2020"
REFERENCE_SYSTEM_DISPLAY = "FSSAI Labelling & Display Regulations 2020 / ICMR-NIN 2020"

# Standard 15 Tracked Nutrients with FSSAI 2020 / ICMR-NIN 2020 daily benchmark values
REFERENCE_LIMITS: Dict[str, NutrientReference] = {
    "energy": NutrientReference(
        key="energy",
        display_name="Energy",
        daily_reference_amount=2000.0,
        unit="kcal",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II / ICMR 2020",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="Standard adult daily reference intake based on 2,000 kcal diet.",
    ),
    "fat": NutrientReference(
        key="fat",
        display_name="Total Fat",
        daily_reference_amount=67.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=True,
        applicability_notes="FSSAI recommended daily reference intake (<30% total energy).",
    ),
    "saturated_fat": NutrientReference(
        key="saturated_fat",
        display_name="Saturated Fat",
        daily_reference_amount=22.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=True,
        applicability_notes="FSSAI maximum daily reference limit (<10% total energy).",
    ),
    "trans_fat": NutrientReference(
        key="trans_fat",
        display_name="Trans Fat",
        daily_reference_amount=2.2,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 / WHO Benchmark",
        supports_percentage=False,  # No % Daily Value; only an upper limit boundary
        alert_threshold_pct=None,
        is_upper_limit=True,
        applicability_notes="WHO/FSSAI cap at <1% energy (<2.2g). No daily recommended target percentage; keep intake as low as possible.",
    ),
    "cholesterol": NutrientReference(
        key="cholesterol",
        display_name="Cholesterol",
        daily_reference_amount=300.0,
        unit="mg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="ICMR / Codex 2020 Reference",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=True,
        applicability_notes="General dietary guideline maximum reference limit for adults.",
    ),
    "carbohydrates": NutrientReference(
        key="carbohydrates",
        display_name="Carbohydrates",
        daily_reference_amount=300.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="FSSAI daily reference intake based on 55-60% of total energy.",
    ),
    "sugars": NutrientReference(
        key="sugars",
        display_name="Total Sugars",
        daily_reference_amount=50.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Benchmark",
        supports_percentage=False,  # Tracked without mandatory % RDA under FSSAI; only added sugars has formal %
        alert_threshold_pct=None,
        is_upper_limit=True,
        applicability_notes="Tracked nutrient. FSSAI regulates Added Sugars specifically (50g); Total Sugars includes naturally occurring sugars.",
    ),
    "added_sugars": NutrientReference(
        key="added_sugars",
        display_name="Added Sugars",
        daily_reference_amount=50.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II / WHO",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=True,
        applicability_notes="FSSAI daily reference upper threshold (<10% total energy = 50g).",
    ),
    "dietary_fibre": NutrientReference(
        key="dietary_fibre",
        display_name="Dietary Fibre",
        daily_reference_amount=30.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II / ICMR 2020",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="Adequate daily intake target recommended for adult health.",
    ),
    "protein": NutrientReference(
        key="protein",
        display_name="Protein",
        daily_reference_amount=54.0,
        unit="g",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="ICMR-NIN 2020 RDA (Adult)",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="ICMR-NIN 2020 adult reference body weight benchmark (approx 0.83g/kg).",
    ),
    "sodium": NutrientReference(
        key="sodium",
        display_name="Sodium",
        daily_reference_amount=2000.0,
        unit="mg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II / WHO",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=True,
        applicability_notes="FSSAI/WHO upper reference threshold (~5g salt/NaCl equivalent per day).",
    ),
    "calcium": NutrientReference(
        key="calcium",
        display_name="Calcium",
        daily_reference_amount=1000.0,
        unit="mg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II / ICMR 2020",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="Adult recommended dietary allowance for bone mineral maintenance.",
    ),
    "iron": NutrientReference(
        key="iron",
        display_name="Iron",
        daily_reference_amount=19.0,
        unit="mg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="ICMR-NIN 2020 RDA (Adult)",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="ICMR-NIN 2020 adult reference intake benchmark.",
    ),
    "potassium": NutrientReference(
        key="potassium",
        display_name="Potassium",
        daily_reference_amount=3500.0,
        unit="mg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="ICMR-NIN 2020 / WHO",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="Adequate adult intake target for electrolyte balance and blood pressure regulation.",
    ),
    "vitamin_d": NutrientReference(
        key="vitamin_d",
        display_name="Vitamin D",
        daily_reference_amount=15.0,
        unit="mcg",
        reference_system=REFERENCE_SYSTEM_NAME,
        source_version="FSSAI 2020 Sched II (600 IU)",
        supports_percentage=True,
        alert_threshold_pct=100.0,
        is_upper_limit=False,
        applicability_notes="Equivalent to 600 IU daily adult reference allowance.",
    ),
}

# Normalization mapping for common variations in food label nutrient naming
NUTRIENT_KEY_ALIASES: Dict[str, str] = {
    # Energy / Calories
    "energy": "energy",
    "calories": "energy",
    "calorie": "energy",
    "kcal": "energy",
    # Fat
    "fat": "fat",
    "total_fat": "fat",
    "total fat": "fat",
    # Saturated fat
    "saturated_fat": "saturated_fat",
    "sat_fat": "saturated_fat",
    "saturated fat": "saturated_fat",
    "saturated fatty acids": "saturated_fat",
    "saturates": "saturated_fat",
    # Trans fat
    "trans_fat": "trans_fat",
    "trans fat": "trans_fat",
    "trans fatty acids": "trans_fat",
    "transfat": "trans_fat",
    # Cholesterol
    "cholesterol": "cholesterol",
    # Carbohydrates
    "carbohydrates": "carbohydrates",
    "carbs": "carbohydrates",
    "total_carbohydrate": "carbohydrates",
    "total carbohydrates": "carbohydrates",
    "total carbohydrate": "carbohydrates",
    "carbohydrate": "carbohydrates",
    # Sugars
    "sugars": "sugars",
    "total_sugars": "sugars",
    "total sugars": "sugars",
    "sugar": "sugars",
    # Added sugars
    "added_sugars": "added_sugars",
    "added sugars": "added_sugars",
    "added sugar": "added_sugars",
    "includes added sugars": "added_sugars",
    # Dietary Fibre
    "fiber": "dietary_fibre",
    "fibre": "dietary_fibre",
    "dietary_fiber": "dietary_fibre",
    "dietary_fibre": "dietary_fibre",
    "dietary fiber": "dietary_fibre",
    "dietary fibre": "dietary_fibre",
    # Protein
    "protein": "protein",
    # Sodium
    "sodium": "sodium",
    # Calcium
    "calcium": "calcium",
    # Iron
    "iron": "iron",
    # Potassium
    "potassium": "potassium",
    # Vitamin D
    "vitamin_d": "vitamin_d",
    "vitamin d": "vitamin_d",
    "vit_d": "vitamin_d",
    "vit d": "vitamin_d",
}


def normalize_nutrient_key(raw_name: str) -> str:
    """
    Normalizes nutrient name to stable canonical key if known.
    Preserves unrecognized keys cleanly in snake_case format.
    """
    if not raw_name:
        return "unknown"
    cleaned = raw_name.strip().lower().replace("-", "_")
    if cleaned in NUTRIENT_KEY_ALIASES:
        return NUTRIENT_KEY_ALIASES[cleaned]
    # Also test replace space with underscore
    slug = cleaned.replace(" ", "_")
    if slug in NUTRIENT_KEY_ALIASES:
        return NUTRIENT_KEY_ALIASES[slug]
    return slug


def get_reference_limit(nutrient_key: str) -> Optional[NutrientReference]:
    """
    Retrieves the structured reference limit for a canonical key, or None if unconfigured.
    """
    canonical_key = normalize_nutrient_key(nutrient_key)
    return REFERENCE_LIMITS.get(canonical_key)


# Safe unit conversions
UNIT_NORMALIZATION = {
    "g": "g",
    "gram": "g",
    "grams": "g",
    "mg": "mg",
    "milligram": "mg",
    "milligrams": "mg",
    "mcg": "mcg",
    "µg": "mcg",
    "ug": "mcg",
    "microgram": "mcg",
    "micrograms": "mcg",
    "kcal": "kcal",
    "calorie": "kcal",
    "calories": "kcal",
    "kj": "kj",
    "ml": "ml",
    "milliliter": "ml",
    "milliliters": "ml",
    "l": "l",
    "liter": "l",
    "liters": "l",
}


def normalize_unit(unit_str: str) -> str:
    cleaned = (unit_str or "").strip().lower()
    return UNIT_NORMALIZATION.get(cleaned, cleaned)


def convert_nutrient_amount(amount: float, from_unit: str, to_unit: str) -> Optional[float]:
    """
    Safely converts amount between compatible mass/energy units.
    Returns None if units are incompatible (e.g. g to kcal or g to ml).
    """
    if amount is None:
        return None

    src = normalize_unit(from_unit)
    dst = normalize_unit(to_unit)

    if src == dst:
        return amount

    # Mass conversions
    # Base: grams
    mass_to_g = {
        "g": 1.0,
        "mg": 0.001,
        "mcg": 0.000001,
    }
    if src in mass_to_g and dst in mass_to_g:
        amount_in_g = amount * mass_to_g[src]
        return amount_in_g / mass_to_g[dst]

    # Energy conversions (kJ <-> kcal)
    # 1 kcal = 4.184 kJ
    if src == "kj" and dst == "kcal":
        return amount / 4.184
    if src == "kcal" and dst == "kj":
        return amount * 4.184

    # Incompatible or non-convertible without density
    return None
