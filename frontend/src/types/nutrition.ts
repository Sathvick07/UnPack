export interface NutrientReference {
  key: string;
  display_name: string;
  daily_reference_amount: number | null;
  unit: string;
  reference_system: string;
  source_version: string;
  supports_percentage: boolean;
  alert_threshold_pct: number | null;
  is_upper_limit: boolean;
  applicability_notes: string;
}

export interface ReferenceLimitsResponse {
  reference_system: string;
  reference_system_display: string;
  disclaimer: string;
  limits: Record<string, NutrientReference>;
}

export interface NutrientContributor {
  product_name: string;
  amount: number;
  unit: string;
  converted_amount?: number;
  servings: number;
}

export interface NutrientTotalItem {
  key: string;
  display_name: string;
  amount: number | null;
  unit: string;
  percentage: number | null;
  percentage_message: string;
  status: 'calculated' | 'unconfigured' | 'no_percentage_standard' | 'amount_unavailable' | 'incompatible_units' | 'all_missing' | 'no_records';
  is_incomplete: boolean;
  missing_products: string[];
  contributors: NutrientContributor[];
  reference: NutrientReference | null;
}

export interface MultiProductAlert {
  id: string;
  nutrient_key: string;
  display_name: string;
  current_amount: number;
  reference_amount: number;
  unit: string;
  percentage: number;
  threshold_pct: number;
  severity: 'CRITICAL' | 'WARNING' | 'ATTENTION' | 'INFO';
  is_incomplete: boolean;
  title: string;
  message: string;
  contributing_products: NutrientContributor[];
  reference_system: string;
  disclaimer: string;
}

export interface ConfirmedIntakeItem {
  id: number;
  product_name: string;
  servings_consumed: number;
  serving_size?: string;
  serving_unit?: string;
  basis_used: 'per_serving' | 'per_100g';
  consumption_time?: string;
  nutrients: Record<string, {
    amount: number | null;
    unit: string;
    is_missing: boolean;
    base_amount?: number | null;
  }>;
}

export interface DailyIntakeSummary {
  date: string;
  total_products_confirmed: number;
  nutrient_totals: Record<string, NutrientTotalItem>;
  alerts: MultiProductAlert[];
  items: ConfirmedIntakeItem[];
  has_incomplete_data: boolean;
  incomplete_nutrients: string[];
  reference_system: {
    name: string;
    display: string;
    disclaimer: string;
  };
}

export interface CreateConsumptionPayload {
  product_name: string;
  scan_id?: string;
  servings_consumed: number;
  serving_size?: string;
  serving_unit?: string;
  basis_used: 'per_serving' | 'per_100g';
  consumption_date?: string;
  nutrition_facts?: Record<string, any>;
  notes?: string;
  idempotency_key?: string;
}

export interface UpdateConsumptionPayload {
  servings_consumed?: number;
  product_name?: string;
  notes?: string;
}
