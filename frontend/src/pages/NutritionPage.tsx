import React from 'react';
import { AppPage } from '../types/navigation';

interface NutritionPageProps {
  onNavigate: (page: AppPage) => void;
}

export const NutritionPage: React.FC<NutritionPageProps> = ({ onNavigate }) => {
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="page-content nutrition-page">
      <div className="page-header">
        <div className="brand-badge">Nutrition & Intake Ledger</div>
        <h1 className="page-title">Daily Confirmed Intake</h1>
        <p className="page-subtitle">
          Accurate nutritional accumulation calculated strictly from foods you explicitly confirm consuming.
        </p>
      </div>

      <div className="date-strip">
        <div className="date-display">
          <span className="calendar-icon">📅</span>
          <span className="date-text">{todayFormatted}</span>
        </div>
        <div className="ledger-rule-badge">
          <span>Rule: Preview ≠ Consumption</span>
        </div>
      </div>

      {/* Macronutrient Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Energy</span>
            <span className="metric-unit">kcal</span>
          </div>
          <div className="metric-value">0</div>
          <div className="metric-footer">
            <span className="metric-target">Target: Configurable in M3</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Protein</span>
            <span className="metric-unit">g</span>
          </div>
          <div className="metric-value">0.0</div>
          <div className="metric-footer">
            <span className="metric-target">Target: Configurable in M3</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Sugars</span>
            <span className="metric-unit">g</span>
          </div>
          <div className="metric-value">0.0</div>
          <div className="metric-footer">
            <span className="metric-target">No added sugar inferred</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Sodium</span>
            <span className="metric-unit">mg</span>
          </div>
          <div className="metric-value">0</div>
          <div className="metric-footer">
            <span className="metric-target">Preserved exact label basis</span>
          </div>
        </div>
      </div>

      {/* Honest Empty State */}
      <div className="empty-state-card">
        <div className="empty-state-icon">🥗</div>
        <h3 className="empty-state-title">No Confirmed Food Items Today</h3>
        <p className="empty-state-text">
          Unpack never fabricates consumption history or invents placeholder meals.
          To add an item to your daily ledger, scan a label, preview the nutrient contribution
          for your portion, and tap <strong>Confirm Consumption</strong>.
        </p>
        <div className="empty-state-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('scan')}
          >
            Scan a Label Now
          </button>
        </div>
      </div>

      {/* Ledger Rules & Verification Standards */}
      <div className="ledger-info-box">
        <h4 className="info-box-title">Our Nutrition Ledger Principles</h4>
        <div className="info-box-grid">
          <div className="info-box-item">
            <strong>1. Explicit Confirmation Only</strong>
            <p>Scanning or previewing a label does not alter your intake history. You must deliberately confirm consumption.</p>
          </div>
          <div className="info-box-item">
            <strong>2. Basis & Unit Preservation</strong>
            <p>Nutrients are calculated per 100g, per 100ml, or per serving strictly based on what the manufacturer label states.</p>
          </div>
          <div className="info-box-item">
            <strong>3. Missing Data ≠ Zero</strong>
            <p>If a label omits a nutrient fact (e.g. trans fat or added sugars), it is recorded as missing or unreported, never zero.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
