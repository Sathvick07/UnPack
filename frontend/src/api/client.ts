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

function getInitialApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // If running in browser and visiting 127.0.0.1, align localhost env URL with 127.0.0.1 to prevent Windows IPv6 connection rejection
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' && envUrl.includes('localhost:8000')) {
      return envUrl.replace('localhost:8000', '127.0.0.1:8000');
    }
    return envUrl;
  }
  // Default to 127.0.0.1:8000 for reliable IPv4 binding on Windows
  return 'http://127.0.0.1:8000';
}

let API_BASE_URL = getInitialApiBaseUrl();

export function getActiveApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const candidateHosts = [
    API_BASE_URL,
    'http://127.0.0.1:8000',
    'http://localhost:8000',
  ];
  // Deduplicate candidate host list
  const uniqueHosts = Array.from(new Set(candidateHosts.map((h) => h.replace(/\/+$/, ''))));

  let lastError: Error | null = null;

  for (const host of uniqueHosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`${host}/api/health/`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Dynamically lock in the verified working backend host for subsequent API calls
        API_BASE_URL = host;
        return data as HealthResponse;
      } else {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error(`Health check request to ${host} timed out after 3500ms`);
      } else {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Backend health check failed: server unreachable');
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
