import { HealthResponse } from '../types/api';
import { LabelAnalysisReport, VerifyFieldsPayload } from '../types/label';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserAccount,
  UserProfile,
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function analyzeLabel(
  imageFile: File,
  restrictions: string[] = [],
  targets: Record<string, any> = {},
  rawText?: string,
  aiInterpretation?: Record<string, any>
): Promise<LabelAnalysisReport> {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('restrictions', JSON.stringify(restrictions));
  formData.append('targets', JSON.stringify(targets));
  if (rawText) {
    formData.append('raw_text', rawText);
  }
  if (aiInterpretation) {
    formData.append('ai_interpretation', JSON.stringify(aiInterpretation));
  }

  const response = await fetch(`${API_BASE_URL}/api/analyze-label/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorDetail = errJson.error;
      }
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function verifyFields(payload: VerifyFieldsPayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/verify-fields/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// --------------------------------------------------------------------------
// Auth & Profile API Endpoints
// --------------------------------------------------------------------------

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.errors?.email?.[0]
      || data.errors?.confirm_password?.[0]
      || data.errors?.password?.[0]
      || data.errors?.full_name?.[0]
      || data.message
      || 'Registration failed.';
    throw new Error(errorMsg);
  }

  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.errors?.non_field_errors?.[0]
      || data.errors?.email?.[0]
      || data.errors?.password?.[0]
      || data.message
      || 'Invalid credentials.';
    throw new Error(errorMsg);
  }

  return data;
}

export async function logoutUser(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Accept': 'application/json',
      },
    });
  } catch {
    // Ignore network errors on logout
  }
}

export async function fetchCurrentUser(token: string): Promise<UserAccount> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user (HTTP ${response.status})`);
  }

  return response.json();
}

export async function updateUserProfile(
  token: string,
  payload: UpdateProfilePayload
): Promise<{ profile: UserProfile; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/profile/`, {
    method: 'PUT',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update profile.');
  }

  return data;
}

// --------------------------------------------------------------------------
// Daily Intake Ledger & Nutrient Reference Limits Endpoints
// --------------------------------------------------------------------------

import {
  ReferenceLimitsResponse,
  DailyIntakeSummary,
  CreateConsumptionPayload,
  UpdateConsumptionPayload,
} from '../types/nutrition';

export async function fetchReferenceLimits(): Promise<ReferenceLimitsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/intake/reference-limits/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch reference limits (HTTP ${response.status})`);
  }

  return response.json();
}

export async function recordConsumption(
  payload: CreateConsumptionPayload,
  token: string
): Promise<{ record: any; message: string; is_duplicate: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/intake/records/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.message || data.error || (data.errors ? JSON.stringify(data.errors) : 'Failed to record consumption.');
    throw new Error(errorMsg);
  }

  return data;
}

export async function fetchDailyIntakeSummary(
  date?: string,
  token?: string
): Promise<DailyIntakeSummary> {
  const url = date
    ? `${API_BASE_URL}/api/intake/summary/?date=${encodeURIComponent(date)}`
    : `${API_BASE_URL}/api/intake/summary/`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch intake summary (HTTP ${response.status})`);
  }

  return response.json();
}

export async function fetchConsumptionRecords(
  date?: string,
  token?: string
): Promise<{ date: string; count: number; records: any[] }> {
  const url = date
    ? `${API_BASE_URL}/api/intake/records/?date=${encodeURIComponent(date)}`
    : `${API_BASE_URL}/api/intake/records/`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch consumption records (HTTP ${response.status})`);
  }

  return response.json();
}

export async function updateConsumptionRecord(
  recordId: number,
  payload: UpdateConsumptionPayload,
  token: string
): Promise<{ record: any; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/intake/records/${recordId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update consumption record.');
  }

  return data;
}

export async function deleteConsumptionRecord(
  recordId: number,
  token: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/intake/records/${recordId}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Token ${token}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete consumption record.');
  }

  return data;
}

export async function fetchIntakeHistoryDates(
  token: string
): Promise<{ dates: string[]; total_logged_days: number }> {
  const response = await fetch(`${API_BASE_URL}/api/intake/history/dates/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch intake history dates (HTTP ${response.status})`);
  }

  return response.json();
}
