export type AllergyStatus = 'none' | 'unanswered' | 'uncertain' | 'specified';

export interface UserProfile {
  full_name: string;
  age_range: string;
  height_cm: number | null;
  weight_kg: number | null;
  allergy_status: AllergyStatus;
  allergies: string[];
  dietary_preferences: string[];
  health_conditions: string[];
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  profile: UserProfile;
}

export interface AuthResponse {
  token: string;
  user: UserAccount;
  message: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  age_range?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  allergy_status?: AllergyStatus;
  allergies?: string[];
  dietary_preferences?: string[];
  health_conditions?: string[];
  onboarding_completed?: boolean;
}
