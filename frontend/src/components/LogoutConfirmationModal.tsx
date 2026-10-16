import React, { useState } from 'react';
import { LabelAnalysisReport } from '../types/label';
import { CreateConsumptionPayload } from '../types/nutrition';
import { recordConsumption } from '../api/client';

interface LogoutConfirmationModalProps {
  pendingReport: LabelAnalysisReport;
  token: string | null;
  isOpen: boolean;
  onCancel: () => void;
  onDiscardAndLogout: () => Promise<void>;
  onSavedAndLogout: () => Promise<void>;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  pendingReport,
  token,
  isOpen,
  onCancel,
  onDiscardAndLogout,
  onSavedAndLogout,
}) => {
  const [servings, setServings] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const productName = pendingReport.file_name
    ? pendingReport.file_name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    : 'Recent Scanned Food Product';

  const handleSaveAndLogout = async () => {
    if (!token) {
      // If unauthenticated, cannot save to server
      await onDiscardAndLogout();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload: CreateConsumptionPayload = {
      product_name: productName,
      scan_id: `logout-scan-${Date.now()}`,
      servings_consumed: servings,
      basis_used: 'per_serving',
      consumption_date: new Date().toISOString().split('T')[0],
      nutrition_facts: pendingReport.nutrition_facts,
      idempotency_key: `logout-idemp-${pendingReport.file_name}-${servings}`,
    };

    try {
      await recordConsumption(payload, token);
      setIsSaving(false);
      await onSavedAndLogout();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(
        err.message || 'Server failed to save your consumption record. You may retry saving or cancel logout.'
      );
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
      <div className="modal-card logout-confirmation-modal" style={{ maxWidth: '520px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <h2 id="logout-confirm-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Unresolved Food Scan
            </h2>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onCancel}
            aria-label="Close"
            disabled={isSaving}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.2rem' }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            You scanned <strong>"{productName}"</strong> without deciding whether to record it to your daily intake ledger.
          </p>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Did you consume this food item before logging out?
          </p>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                color: '#f87171',
                fontSize: '0.86rem',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              border: '1px solid var(--border-subtle)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Portion Consumed:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                className="text-input"
                style={{ width: '80px', padding: '0.35rem 0.5rem' }}
                value={servings}
                onChange={(e) => setServings(parseFloat(e.target.value) || 1.0)}
                disabled={isSaving}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>servings</span>
            </div>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            padding: '1rem 1.2rem',
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleSaveAndLogout}
            disabled={isSaving}
          >
            {isSaving ? 'Saving Record & Logging Out...' : '✓ Yes, I Consumed It — Save & Log Out'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onDiscardAndLogout}
              disabled={isSaving}
            >
              No, I Didn't Consume It
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
