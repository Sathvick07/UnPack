import React from 'react';
import { ConnectionState } from '../types/api';

interface StatusPillProps {
  state: ConnectionState;
  latency: number | null;
  onRefresh?: () => void;
}

export const StatusPill: React.FC<StatusPillProps> = ({ state, latency, onRefresh }) => {
  return (
    <button
      className={`status-pill status-${state}`}
      onClick={onRefresh}
      title="Click to re-check backend connection status"
      type="button"
    >
      <span className="status-dot"></span>
      <span className="status-text">
        {state === 'checking' && 'API: Checking...'}
        {state === 'connected' && `API: Online ${latency !== null ? `(${latency}ms)` : ''}`}
        {state === 'error' && 'API: Offline'}
        {state === 'idle' && 'API: Idle'}
      </span>
    </button>
  );
};
