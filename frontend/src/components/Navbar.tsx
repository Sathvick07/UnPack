import React from 'react';
import { AppPage } from '../types/navigation';
import { ConnectionState } from '../types/api';
import { StatusPill } from './StatusPill';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  connectionState: ConnectionState;
  latency: number | null;
  onRefreshHealth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  connectionState,
  latency,
  onRefreshHealth,
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate('home')} role="button" tabIndex={0}>
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16.5l-9 5.2-9-5.2V7.5l9-5.2 9 5.2v9z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Unpack</span>
            <span className="brand-sub">Know What's Inside.</span>
          </div>
        </div>

        <div className="nav-links">
          <button
            type="button"
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`nav-link ${currentPage === 'scan' ? 'active' : ''}`}
            onClick={() => onNavigate('scan')}
          >
            <span className="nav-icon">📷</span>
            <span>Scan Label</span>
          </button>

          <button
            type="button"
            className={`nav-link ${currentPage === 'nutrition' ? 'active' : ''}`}
            onClick={() => onNavigate('nutrition')}
          >
            <span className="nav-icon">🥗</span>
            <span>Nutrition</span>
          </button>
        </div>

        <div className="navbar-actions">
          <StatusPill
            state={connectionState}
            latency={latency}
            onRefresh={onRefreshHealth}
          />
        </div>
      </div>
    </nav>
  );
};
