import React, { useState, useEffect, useRef } from 'react';
import { LabelAnalysisReport, NutritionFact } from '../types/label';
import { getLocalDateString } from '../utils/date';
import { StatusAlert } from './StatusAlert';
import { AppPage } from '../types/navigation';

export type NavigationTarget =
  | { type: 'page'; page: AppPage; sectionId?: string; analysisId?: string }
  | { type: 'logout' }
  | null;

interface MandatoryConsumptionModalProps {
  isOpen: boolean;
  pendingReport: LabelAnalysisReport | null;
  productName: string;
  targetAction: NavigationTarget;
  onConfirmConsumed: (
    servings: number,
    basis: 'per_serving' | 'per_100g',
    productName: string,
    date?: string,
    notes?: string
  ) => Promise<void>;
  onConfirmNotConsumed: () => void;
  onCancel: () => void;
}

export const MandatoryConsumptionModal: React.FC<MandatoryConsumptionModalProps> = ({
  isOpen,
  pendingReport,
  productName,
  targetAction,
  onConfirmConsumed,
  onConfirmNotConsumed,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Initial product name derived from props or file name
  const initialProductName = productName?.trim()
    ? productName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    : (pendingReport?.file_name
        ? pendingReport.file_name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        : 'Scanned Food Product');

  const [effectiveProductName, setEffectiveProductName] = useState(initialProductName);
  const [servings, setServings] = useState<number>(1.0);
  const [customServingsInput, setCustomServingsInput] = useState<string>('1.0');
  const [isCustomServing, setIsCustomServing] = useState<boolean>(false);
  const [basisUsed, setBasisUsed] = useState<'per_serving' | 'per_100g'>('per_serving');
  const [consumptionDate, setConsumptionDate] = useState<string>(getLocalDateString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync effective name when pendingReport changes
  useEffect(() => {
    if (pendingReport) {
      const derived = productName?.trim()
        ? productName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        : (pendingReport.file_name
            ? pendingReport.file_name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
            : 'Scanned Food Product');
      setEffectiveProductName(derived);
    }
  }, [pendingReport, productName]);

  // Handle Escape key press to cancel and stay on dashboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  // Trap body scroll while modal is visible
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // If closed or no active report, render nothing (no stray backdrop or overlay)
  if (!isOpen || !pendingReport) {
    return null;
  }

  const destinationLabel =
    targetAction?.type === 'logout'
      ? 'logging out'
      : targetAction?.type === 'page'
      ? `navigating to ${targetAction.page.toUpperCase()}`
      : 'leaving this analysis';

  const isNavigationInterception = targetAction !== null;

  const handleServingChipClick = (value: number) => {
    setIsCustomServing(false);
    setServings(value);
    setCustomServingsInput(String(value));
    setErrorMessage(null);
  };

  const handleCustomServingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomServingsInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setServings(parsed);
      setErrorMessage(null);
    }
  };

  const handleConfirm = async () => {
    if (servings <= 0 || isNaN(servings)) {
      setErrorMessage('Please specify a valid serving quantity greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirmConsumed(
        servings,
        basisUsed,
        effectiveProductName.trim() || 'Scanned Food Product',
        consumptionDate,
        notes
      );
      // Navigation continuation is handled in onConfirmConsumed after successful save
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(
        err.message || 'Failed to save consumption record. Please check connection and retry.'
      );
    }
  };

  const handleNotConsumed = () => {
    if (isSubmitting) return;
    onConfirmNotConsumed();
  };

  // Extract valid nutrients from report for intake preview table
  const previewNutrients = Object.entries(pendingReport.nutrition_facts || {}).filter(
    ([, fact]) => fact.value !== null || fact.serving_value !== null
  );

  return (
    <div
      className="consumption-prompt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consumption-modal-title"
      onClick={(e) => {
        // Close on clicking backdrop outside the dialog card
        if (e.target === e.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div ref={modalRef} className="consumption-prompt-modal" role="document">
        {/* Header */}
        <div className="prompt-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.45rem', lineHeight: 1 }} aria-hidden="true">
              🥗
            </span>
            <div>
              <h3 id="consumption-modal-title" className="prompt-modal-title">
                {isNavigationInterception ? 'Unresolved Food Consumption Decision' : 'Record Confirmed Consumption'}
              </h3>
              <span className="prompt-modal-rule-tag">
                Rule: Preview ≠ Consumption
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onCancel}
            aria-label="Cancel and close dialog"
            disabled={isSubmitting}
            title="Cancel (Escape)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="prompt-modal-body">
          {/* Error Message if backend save fails */}
          {errorMessage && (
            <div style={{ marginBottom: '0.5rem' }}>
              <StatusAlert
                type="error"
                title="Failed to Save Consumption Record"
                message={errorMessage}
                onRetry={handleConfirm}
                retryLabel="Retry Save"
                onDismiss={() => setErrorMessage(null)}
              />
            </div>
          )}

          {/* Context Banner */}
          {isNavigationInterception ? (
            <div className="prompt-interception-banner">
              <span className="interception-icon" aria-hidden="true">⚠️</span>
              <div>
                <strong>Decision Required Before {destinationLabel}:</strong>
                <p>
                  Did you eat or drink <strong>"{effectiveProductName}"</strong>? Confirming your portion updates your daily nutrient totals and limits.
                </p>
              </div>
            </div>
          ) : (
            <p className="prompt-intro-text">
              Analyzing a food label alone never marks it as consumed. Confirm your portion if you ate or drank this product to log it to your daily nutrient ledger.
            </p>
          )}

          {/* Product Name Field */}
          <div className="prompt-field-group">
            <label htmlFor="consumption-product-name" className="prompt-field-label">
              Product Description:
            </label>
            <input
              id="consumption-product-name"
              type="text"
              className="prompt-text-input"
              value={effectiveProductName}
              onChange={(e) => setEffectiveProductName(e.target.value)}
              placeholder="e.g. Whole Wheat Bread or Oat Milk 250ml"
              disabled={isSubmitting}
            />
          </div>

          {/* Portion & Serving Selection */}
          <div className="prompt-field-group">
            <label className="prompt-field-label">
              Portion Consumed:
            </label>
            <div className="portion-chips-list">
              {[0.5, 1.0, 1.5, 2.0].map((val) => {
                const isSelected = !isCustomServing && servings === val;
                return (
                  <button
                    key={val}
                    type="button"
                    className={`btn-portion-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => handleServingChipClick(val)}
                    disabled={isSubmitting}
                  >
                    {val === 1.0 ? '1 serving (standard)' : `${val} servings`}
                  </button>
                );
              })}
              <button
                type="button"
                className={`btn-portion-chip ${isCustomServing ? 'active' : ''}`}
                onClick={() => setIsCustomServing(true)}
                disabled={isSubmitting}
              >
                Custom portion...
              </button>
            </div>

            {isCustomServing && (
              <div className="custom-servings-wrapper">
                <span className="custom-servings-label">Exact Servings:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  className="prompt-text-input custom-servings-input"
                  value={customServingsInput}
                  onChange={handleCustomServingsChange}
                  disabled={isSubmitting}
                />
                <span className="custom-servings-hint">
                  (e.g., 0.25 for a quarter portion, 3.0 for three portions)
                </span>
              </div>
            )}
          </div>

          {/* Basis and Date Options */}
          <div className="prompt-grid-two-col">
            <div>
              <label htmlFor="basis-select" className="prompt-field-label">
                Label Calculation Basis:
              </label>
              <select
                id="basis-select"
                className="prompt-select-input"
                value={basisUsed}
                onChange={(e) => setBasisUsed(e.target.value as 'per_serving' | 'per_100g')}
                disabled={isSubmitting}
              >
                <option value="per_serving">Per Serving (Standard Portion)</option>
                <option value="per_100g">Per 100 g / 100 ml (Metric Base)</option>
              </select>
            </div>

            <div>
              <label htmlFor="consumption-date" className="prompt-field-label">
                Consumption Date:
              </label>
              <input
                id="consumption-date"
                type="date"
                className="prompt-text-input"
                value={consumptionDate}
                onChange={(e) => setConsumptionDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Relevant Nutrition Summary Table */}
          {previewNutrients.length > 0 && (
            <div className="nutrition-preview-section">
              <div className="nutrition-preview-header">
                <strong className="nutrition-preview-title">
                  Nutritional Intake for {servings} Serving{servings !== 1 ? 's' : ''}:
                </strong>
                <span className="nutrition-preview-badge">
                  ✓ Calculated from label facts
                </span>
              </div>

              <div className="nutrition-preview-table-box">
                <table className="nutrition-preview-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Nutrient</th>
                      <th style={{ textAlign: 'right' }}>Base Label Value</th>
                      <th style={{ textAlign: 'right' }}>Your Daily Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewNutrients.map(([k, fact]: [string, NutritionFact]) => {
                      const baseVal =
                        basisUsed === 'per_serving'
                          ? fact.serving_value !== null && fact.serving_value !== undefined
                            ? fact.serving_value
                            : fact.value
                          : fact.value !== null && fact.value !== undefined
                          ? fact.value
                          : fact.serving_value;

                      const calculatedVal =
                        baseVal !== null && baseVal !== undefined
                          ? (baseVal * servings).toFixed(1)
                          : '—';

                      return (
                        <tr key={k}>
                          <td className="table-nutrient-name">
                            {fact.nutrient ? fact.nutrient.replace(/_/g, ' ') : k.replace(/_/g, ' ')}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {baseVal !== null && baseVal !== undefined
                              ? `${baseVal} ${fact.unit}`
                              : 'Not provided'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary)' }}>
                            {calculatedVal !== '—' ? `${calculatedVal} ${fact.unit}` : 'Not provided'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <span className="nutrition-disclaimer-note">
                * Unlisted nutrients on packaging are strictly preserved as "Not provided" and never assumed zero.
              </span>
            </div>
          )}

          {/* Optional Notes */}
          <div className="prompt-field-group">
            <label htmlFor="consumption-notes" className="prompt-field-label">
              Optional Note:
            </label>
            <input
              id="consumption-notes"
              type="text"
              className="prompt-text-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Afternoon snack, half packet"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Action Controls / Footer */}
        <div className="prompt-modal-footer">
          <div className="primary-decision-row">
            <button
              type="button"
              className="btn btn-primary btn-action-consumed"
              onClick={handleConfirm}
              disabled={isSubmitting || servings <= 0}
            >
              {isSubmitting ? (
                <span>Saving to Ledger...</span>
              ) : (
                <span>✓ Yes, I Consumed It ({servings} Serving{servings !== 1 ? 's' : ''})</span>
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-action-not-consumed"
              onClick={handleNotConsumed}
              disabled={isSubmitting}
              title="Do not add nutrients to daily ledger and resolve this product"
            >
              <span>🚫 No, Did Not Consume (Preview Only)</span>
            </button>
          </div>

          <div className="secondary-cancel-row">
            <button
              type="button"
              className="btn btn-outline btn-action-cancel"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel (Stay on Scan Dashboard)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
