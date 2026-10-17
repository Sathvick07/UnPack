import React, { useState } from 'react';
import { LabelAnalysisReport, NutritionFact } from '../types/label';
import { CreateConsumptionPayload } from '../types/nutrition';
import { useAuth } from '../context/AuthContext';
import { recordConsumption } from '../api/client';
import { getLocalDateString } from '../utils/date';
import { StatusAlert } from './StatusAlert';

interface RecordConsumptionModalProps {
  report: LabelAnalysisReport;
  defaultProductName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const RecordConsumptionModal: React.FC<RecordConsumptionModalProps> = ({
  report,
  defaultProductName = '',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token, isAuthenticated } = useAuth();

  // Initial product name derived from file name or generic label
  const initialName = defaultProductName
    ? defaultProductName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    : (report.file_name ? report.file_name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Scanned Food Product');

  const [productName, setProductName] = useState(initialName);
  const [servings, setServings] = useState<number>(1.0);
  const [customServingsInput, setCustomServingsInput] = useState<string>('1.0');
  const [isCustomServing, setIsCustomServing] = useState<boolean>(false);
  const [basisUsed, setBasisUsed] = useState<'per_serving' | 'per_100g'>('per_serving');
  const [servingSize, setServingSize] = useState<string>('1 serving');
  const [servingUnit, setServingUnit] = useState<string>('serving');
  const [consumptionDate, setConsumptionDate] = useState<string>(getLocalDateString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleServingsChipClick = (value: number) => {
    setIsCustomServing(false);
    setServings(value);
    setCustomServingsInput(value.toString());
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
    if (!isAuthenticated || !token) {
      setErrorMessage('You must be logged in to record food consumption to your daily ledger.');
      return;
    }

    if (servings <= 0 || isNaN(servings)) {
      setErrorMessage('Please specify a valid serving quantity greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Unique submission token generated per user confirmation attempt
    const submissionNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload: CreateConsumptionPayload = {
      product_name: productName.trim() || 'Scanned Food Product',
      scan_id: `scan-${report.file_name || 'food'}-${Date.now()}`,
      servings_consumed: servings,
      serving_size: servingSize.trim(),
      serving_unit: servingUnit.trim(),
      basis_used: basisUsed,
      consumption_date: consumptionDate,
      nutrition_facts: report.nutrition_facts,
      notes: notes.trim(),
      idempotency_key: `idemp-${report.file_name || 'food'}-${submissionNonce}`,
    };

    try {
      const result = await recordConsumption(payload, token);
      setIsSubmitting(false);

      // Dispatch global consumption event to immediately synchronize Daily Limits and active ledgers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('unpack:consumption-recorded', {
            detail: { date: consumptionDate, record: result.record },
          })
        );
      }

      onSuccess(result.message || 'Consumption recorded successfully.');
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to save consumption record. Please check network connection and retry.');
    }
  };

  // Preview portion nutrient calculations
  const previewNutrients = Object.entries(report.nutrition_facts).filter(
    ([, fact]) => fact.value !== null || fact.serving_value !== null
  );

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="modal-card record-consumption-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-intake-title"
        style={{ maxWidth: '620px', width: '92%' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🥗</span>
            <div>
              <h2 id="record-intake-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Record Confirmed Consumption
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Rule: Preview ≠ Consumption. Only confirm items you actually consumed.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '1.2rem' }}>
          {errorMessage && (
            <div style={{ marginBottom: '1.25rem' }}>
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

          {/* Product Name */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Product Name / Description:
            </label>
            <input
              type="text"
              className="text-input"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Oat Milk 250ml or Whole Wheat Bread"
              disabled={isSubmitting}
            />
          </div>

          {/* Portion & Servings Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Portion Consumed:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
              {[0.5, 1.0, 1.5, 2.0].map((val) => {
                const isSelected = !isCustomServing && servings === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleServingsChipClick(val)}
                    disabled={isSubmitting}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {val === 1.0 ? '1 serving (standard)' : `${val} servings`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomServing(true)}
                disabled={isSubmitting}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isCustomServing ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                  color: isCustomServing ? '#fff' : 'var(--text-primary)',
                  border: isCustomServing ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease',
                }}
              >
                Custom quantity...
              </button>
            </div>

            {isCustomServing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Servings:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  className="text-input"
                  style={{ width: '120px' }}
                  value={customServingsInput}
                  onChange={handleCustomServingsChange}
                  disabled={isSubmitting}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  (e.g. 0.25 for a quarter, 3.0 for three packages)
                </span>
              </div>
            )}
          </div>

          {/* Serving Basis & Serving Size Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Label Calculation Basis:
              </label>
              <select
                className="select-input"
                value={basisUsed}
                onChange={(e) => setBasisUsed(e.target.value as 'per_serving' | 'per_100g')}
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
              >
                <option value="per_serving">Per Serving (Standard Portion)</option>
                <option value="per_100g">Per 100 g / 100 ml (Metric Base)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Serving Description:
              </label>
              <input
                type="text"
                className="text-input"
                value={servingSize}
                onChange={(e) => {
                  setServingSize(e.target.value);
                  setServingUnit(e.target.value);
                }}
                placeholder="e.g. 1 can (330ml) or 30g"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Consumption Date:
            </label>
            <input
              type="date"
              className="text-input"
              value={consumptionDate}
              onChange={(e) => setConsumptionDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Portion Calculation Preview Table */}
          <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Nutritional Contribution for {servings} Serving{servings !== 1 ? 's' : ''}:
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-lime)' }}>
                ✓ Calculated on confirmed portion
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Nutrient</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Base Label Value</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Your Intake Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {previewNutrients.map(([k, fact]: [string, NutritionFact]) => {
                    const baseVal = basisUsed === 'per_serving'
                      ? (fact.serving_value !== null && fact.serving_value !== undefined ? fact.serving_value : fact.value)
                      : (fact.value !== null && fact.value !== undefined ? fact.value : fact.serving_value);

                    const calculatedVal = baseVal !== null && baseVal !== undefined
                      ? (baseVal * servings).toFixed(1)
                      : '—';

                    return (
                      <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>
                          {fact.nutrient ? fact.nutrient.replace(/_/g, ' ') : k.replace(/_/g, ' ')}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.45rem 0.75rem', color: 'var(--text-secondary)' }}>
                          {baseVal !== null && baseVal !== undefined ? `${baseVal} ${fact.unit}` : 'Not provided'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.45rem 0.75rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                          {calculatedVal !== '—' ? `${calculatedVal} ${fact.unit}` : 'Not provided'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              * Missing label data is strictly kept as Not provided and is never fabricated into zero.
            </span>
          </div>

          {/* Optional Notes */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Optional Notes:
            </label>
            <input
              type="text"
              className="text-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Snack after workout"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel / Preview Only
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isSubmitting ? (
              <span>Saving to Ledger...</span>
            ) : (
              <span>✓ Confirm & Add to Daily Ledger</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
