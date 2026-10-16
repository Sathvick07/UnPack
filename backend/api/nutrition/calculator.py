"""
Nutrition Intake and Accumulation Calculator.

Provides pure, testable calculation functions for:
1. Individual product consumption contributions (handling multiple/partial servings, explicit zero, missing data).
2. Reference percentage calculation with unit conversion safeguards.
3. Daily multi-product accumulation with incomplete data tracking and educational alerts.
"""

from typing import Dict, Any, List, Optional
from .reference_limits import (
    REFERENCE_SYSTEM_NAME,
    REFERENCE_SYSTEM_DISPLAY,
    REFERENCE_LIMITS,
    get_reference_limit,
    normalize_nutrient_key,
    convert_nutrient_amount,
    normalize_unit,
)


def calculate_product_contribution(
    nutrition_facts: Dict[str, Any],
    servings_consumed: float,
    basis_used: str = "per_serving",
    serving_size: Optional[str] = None,
    serving_unit: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Computes exact nutrient contribution for a confirmed consumption event.

    Rules:
    - servings_consumed must be a positive number (> 0).
    - If a nutrient has explicit 0.0, the contribution is 0.0 (is_missing=False).
    - If a nutrient is missing (None), contribution is None (is_missing=True). Never coerce to 0.
    - If basis_used is 'per_serving', uses fact['serving_value'] if present, else fallback to fact['value'].
    - If basis_used is 'per_100g', uses fact['value'].
    """
    contributions: Dict[str, Dict[str, Any]] = {}

    for raw_key, fact in (nutrition_facts or {}).items():
        canonical_key = normalize_nutrient_key(raw_key)

        # Extract base value according to chosen basis
        base_val: Optional[float] = None
        if basis_used == "per_serving":
            if fact.get("serving_value") is not None:
                base_val = fact.get("serving_value")
            elif fact.get("value") is not None:
                # If per-serving isn't separated on label, fallback to value
                base_val = fact.get("value")
        else:  # per_100g
            if fact.get("value") is not None:
                base_val = fact.get("value")
            elif fact.get("serving_value") is not None:
                base_val = fact.get("serving_value")

        unit = fact.get("unit", "")
        status = fact.get("status", "detected")

        if base_val is not None:
            try:
                base_float = float(base_val)
                # Calculate portion amount
                calculated_amount = round(base_float * float(servings_consumed), 2)
                contributions[canonical_key] = {
                    "canonical_key": canonical_key,
                    "original_key": raw_key,
                    "amount": calculated_amount,
                    "unit": unit,
                    "basis_used": basis_used,
                    "servings_multiplier": float(servings_consumed),
                    "base_amount": base_float,
                    "is_missing": False,
                    "is_zero_explicit": (base_float == 0.0),
                    "status": "detected" if status != "uncertain" else "uncertain",
                }
            except (ValueError, TypeError):
                contributions[canonical_key] = {
                    "canonical_key": canonical_key,
                    "original_key": raw_key,
                    "amount": None,
                    "unit": unit,
                    "basis_used": basis_used,
                    "servings_multiplier": float(servings_consumed),
                    "base_amount": None,
                    "is_missing": True,
                    "is_zero_explicit": False,
                    "status": "not_provided",
                }
        else:
            contributions[canonical_key] = {
                "canonical_key": canonical_key,
                "original_key": raw_key,
                "amount": None,
                "unit": unit,
                "basis_used": basis_used,
                "servings_multiplier": float(servings_consumed),
                "base_amount": None,
                "is_missing": True,
                "is_zero_explicit": False,
                "status": "not_provided",
            }

    return contributions


def calculate_nutrient_percentage(
    nutrient_key: str,
    consumed_amount: Optional[float],
    consumed_unit: str,
) -> Dict[str, Any]:
    """
    Calculates percentage of daily reference limit for a given consumed amount.
    Validates unit compatibility and converts safely where necessary.
    """
    ref = get_reference_limit(nutrient_key)

    if consumed_amount is None:
        return {
            "percentage": None,
            "status": "amount_unavailable",
            "message": "Amount unavailable.",
            "reference": ref.to_dict() if ref else None,
        }

    if not ref or ref.daily_reference_amount is None:
        return {
            "percentage": None,
            "status": "unconfigured",
            "message": "Daily reference not configured.",
            "reference": None,
        }

    if not ref.supports_percentage:
        return {
            "percentage": None,
            "status": "no_percentage_standard",
            "message": ref.applicability_notes or "Tracked without % daily value.",
            "reference": ref.to_dict(),
        }

    # Safe unit conversion if needed
    effective_amount = consumed_amount
    if normalize_unit(consumed_unit) != normalize_unit(ref.unit):
        converted = convert_nutrient_amount(consumed_amount, consumed_unit, ref.unit)
        if converted is None:
            return {
                "percentage": None,
                "status": "incompatible_units",
                "message": f"Cannot calculate percentage: consumed unit '{consumed_unit}' is incompatible with reference unit '{ref.unit}'.",
                "reference": ref.to_dict(),
            }
        effective_amount = converted

    percentage = round((effective_amount / ref.daily_reference_amount) * 100.0, 1)

    return {
        "percentage": percentage,
        "effective_amount": round(effective_amount, 2),
        "status": "calculated",
        "message": f"{percentage}% of daily reference",
        "reference": ref.to_dict(),
    }


def accumulate_daily_intake(
    records: List[Dict[str, Any]],
    date_str: str,
) -> Dict[str, Any]:
    """
    Aggregates multiple confirmed consumption records for a specific date.

    Returns:
    - nutrient_totals: accumulated amounts, units, reference info, and % reference
    - alerts: multi-product alerts when alert thresholds are met or exceeded
    - items_summary: itemized product list with their respective contributions
    - has_incomplete_data: boolean flag indicating if any consumed product had missing data
    - incomplete_nutrients: list of nutrient keys where one or more products had missing data
    """
    # Track totals per nutrient
    # { canonical_key: { "total_amount": float, "unit": str, "contributors": list, "missing_products": list } }
    aggregated: Dict[str, Dict[str, Any]] = {}

    # Initialize known reference nutrients so empty ledger still shows expected structure
    for key, ref in REFERENCE_LIMITS.items():
        aggregated[key] = {
            "total_amount": 0.0,
            "unit": ref.unit,
            "contributors": [],
            "missing_products": [],
            "all_missing": True,
            "explicit_zero_only": True,
        }

    items_summary: List[Dict[str, Any]] = []

    for rec in records:
        product_name = rec.get("product_name") or "Unnamed Food Product"
        record_id = rec.get("id")
        servings = rec.get("servings_consumed", 1.0)
        snapshot = rec.get("nutrients_snapshot", {})

        items_summary.append({
            "id": record_id,
            "product_name": product_name,
            "servings_consumed": servings,
            "serving_size": rec.get("serving_size"),
            "serving_unit": rec.get("serving_unit"),
            "basis_used": rec.get("basis_used"),
            "consumption_time": rec.get("consumption_time"),
            "nutrients": snapshot,
        })

        for raw_k, contrib in snapshot.items():
            k = normalize_nutrient_key(raw_k)
            ref = get_reference_limit(k)
            default_unit = ref.unit if ref else (contrib.get("unit") or "g")

            if k not in aggregated:
                aggregated[k] = {
                    "total_amount": 0.0,
                    "unit": default_unit,
                    "contributors": [],
                    "missing_products": [],
                    "all_missing": True,
                    "explicit_zero_only": True,
                }

            is_missing = contrib.get("is_missing", False)
            amt = contrib.get("amount")

            if is_missing or amt is None:
                aggregated[k]["missing_products"].append(product_name)
            else:
                unit = contrib.get("unit") or aggregated[k]["unit"]
                # Convert to target aggregated unit if compatible
                converted_amt = amt
                if normalize_unit(unit) != normalize_unit(aggregated[k]["unit"]):
                    conv = convert_nutrient_amount(amt, unit, aggregated[k]["unit"])
                    if conv is not None:
                        converted_amt = conv
                    else:
                        # Cannot safely convert; preserve as separate or record
                        converted_amt = amt

                aggregated[k]["total_amount"] += converted_amt
                aggregated[k]["all_missing"] = False
                if amt != 0.0:
                    aggregated[k]["explicit_zero_only"] = False

                aggregated[k]["contributors"].append({
                    "product_name": product_name,
                    "amount": round(amt, 2),
                    "unit": unit,
                    "converted_amount": round(converted_amt, 2),
                    "servings": servings,
                })

    # Prepare structured nutrient totals
    nutrient_totals: Dict[str, Any] = {}
    incomplete_nutrients: List[str] = []
    alerts: List[Dict[str, Any]] = []

    for k, data in aggregated.items():
        ref = get_reference_limit(k)
        has_records = len(records) > 0
        is_incomplete = len(data["missing_products"]) > 0

        if is_incomplete:
            incomplete_nutrients.append(k)

        # If there are no records, consumed amount is 0.0 (or None if unconfigured)
        if not has_records:
            amount_val: Optional[float] = 0.0
            status_text = "no_records"
        elif data["all_missing"]:
            amount_val = None
            status_text = "all_missing"
        else:
            amount_val = round(data["total_amount"], 2)
            status_text = "accumulated"

        pct_info = calculate_nutrient_percentage(k, amount_val, data["unit"])

        display_name = ref.display_name if ref else k.replace("_", " ").title()

        nutrient_totals[k] = {
            "key": k,
            "display_name": display_name,
            "amount": amount_val,
            "unit": data["unit"],
            "percentage": pct_info.get("percentage"),
            "percentage_message": pct_info.get("message"),
            "status": pct_info.get("status") if amount_val is not None else "amount_unavailable",
            "is_incomplete": is_incomplete,
            "missing_products": data["missing_products"],
            "contributors": data["contributors"],
            "reference": ref.to_dict() if ref else None,
        }

        # Multi-product alert evaluation
        if (
            has_records
            and ref
            and ref.alert_threshold_pct is not None
            and pct_info.get("percentage") is not None
        ):
            pct = pct_info["percentage"]
            threshold = ref.alert_threshold_pct
            if pct >= threshold:
                severity = "CRITICAL" if pct >= 120.0 else "WARNING"
                is_exceeded = pct >= 100.0

                contributor_names = [c["product_name"] for c in data["contributors"]]
                unique_products = list(dict.fromkeys(contributor_names))
                products_str = ", ".join(unique_products) if unique_products else "consumed items"

                alert_title = (
                    f"Daily {display_name} Reference Exceeded"
                    if is_exceeded
                    else f"Daily {display_name} Alert Threshold Reached"
                )

                alert_msg = (
                    f"Your confirmed intake of {display_name} has reached {amount_val} {data['unit']} "
                    f"({pct}% of the {ref.reference_system} daily reference limit of {ref.daily_reference_amount} {ref.unit}). "
                    f"Contributed by: {products_str}."
                )

                if is_incomplete:
                    alert_msg += f" Note: Total may be incomplete as {', '.join(data['missing_products'])} did not declare {display_name}."

                alerts.append({
                    "id": f"alert-{k}-{date_str}",
                    "nutrient_key": k,
                    "display_name": display_name,
                    "current_amount": amount_val,
                    "reference_amount": ref.daily_reference_amount,
                    "unit": data["unit"],
                    "percentage": pct,
                    "threshold_pct": threshold,
                    "severity": severity,
                    "is_incomplete": is_incomplete,
                    "title": alert_title,
                    "message": alert_msg,
                    "contributing_products": data["contributors"],
                    "reference_system": ref.reference_system,
                    "disclaimer": "General dietary educational alert based on packaging reference standards, not personalized medical diagnosis.",
                })

    return {
        "date": date_str,
        "total_products_confirmed": len(records),
        "nutrient_totals": nutrient_totals,
        "alerts": alerts,
        "items": items_summary,
        "has_incomplete_data": len(incomplete_nutrients) > 0,
        "incomplete_nutrients": incomplete_nutrients,
        "reference_system": {
            "name": REFERENCE_SYSTEM_NAME,
            "display": REFERENCE_SYSTEM_DISPLAY,
            "disclaimer": (
                "Reference benchmarks are based on FSSAI 2020 / ICMR-NIN 2020 adult guidelines (2,000 kcal diet). "
                "These general educational references do not replace individual medical or dietary advice."
            ),
        },
    }
