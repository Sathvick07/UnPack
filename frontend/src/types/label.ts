export type QualityTier = 'CLEAR' | 'MODERATE' | 'UNCERTAIN' | 'UNREADABLE';
export type EvidenceStatus = 'detected' | 'uncertain' | 'unreadable' | 'not_provided' | 'ambiguous' | 'needs_review' | 'unknown';
export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'ATTENTION' | 'INFO';

export interface ImageQualityInfo {
  is_valid: boolean;
  file_name: string;
  file_size_kb: number;
  width: number;
  height: number;
  format: string;
  aspect_ratio: number;
  contrast_score: number;
  blur_metric?: number;
  is_curved_surface?: boolean;
  quality_tier: QualityTier;
  quality_score: number;
  warnings: string[];
  retake_recommendations: string[];
}

export interface ExtractedIngredient {
  name: string;
  source_text: string;
  status: EvidenceStatus;
  confidence: number;
  bounding_box?: [number, number, number, number] | null;
  notes?: string;
}

export interface AllergenStatement {
  notice_type: 'contains' | 'may_contain';
  source_text: string;
  bounding_box?: [number, number, number, number] | null;
}

export interface NutritionFact {
  nutrient: string;
  value: number | null;
  unit: string;
  basis: string;
  serving_value?: number | null;
  serving_basis?: string;
  status: EvidenceStatus;
  source_text: string;
  is_zero_explicit?: boolean;
}

export interface CompatibilityFinding {
  id?: string;
  restriction?: string;
  display_name?: string;
  target?: string;
  status: string;
  severity: FindingSeverity;
  explanation: string;
  evidence: string;
  source_type: string;
  action_recommendation?: string;
  requires_manual_confirmation: boolean;
}

export interface LabelAnalysisReport {
  file_name: string;
  quality: ImageQualityInfo;
  readability_status: QualityTier;
  is_complete: boolean;
  completeness_score: number;
  raw_text: string;
  ingredients: ExtractedIngredient[];
  allergen_statements: AllergenStatement[];
  nutrition_facts: Record<string, NutritionFact>;
  findings: CompatibilityFinding[];
  uncertainty_flags: string[];
  manual_confirmation_needed: boolean;
  retake_prompt?: string | null;
}

export interface VerifyFieldsPayload {
  ingredients: ExtractedIngredient[];
  allergen_statements: AllergenStatement[];
  nutrition_facts: Record<string, NutritionFact>;
  restrictions: string[];
  targets: Record<string, any>;
  raw_text: string;
  quality_tier: QualityTier;
}
