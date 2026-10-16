export interface HealthResponse {
  status: string;
  app: string;
  tagline: string;
  version: string;
  environment: string;
}

export type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';
