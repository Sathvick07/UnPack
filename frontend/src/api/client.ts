import { HealthResponse } from '../types/api';
import { LabelAnalysisReport, VerifyFieldsPayload } from '../types/label';

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
  rawText?: string
): Promise<LabelAnalysisReport> {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('restrictions', JSON.stringify(restrictions));
  formData.append('targets', JSON.stringify(targets));
  if (rawText) {
    formData.append('raw_text', rawText);
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
