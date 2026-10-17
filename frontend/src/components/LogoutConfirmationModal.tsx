import React, { useState } from 'react';
import { LabelAnalysisReport } from '../types/label';
import { CreateConsumptionPayload } from '../types/nutrition';
import { recordConsumption } from '../api/client';
import { StatusAlert } from './StatusAlert';

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
      <div className="modal-card logout-confirmation-modal" style={{ maxWidth: '520px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.4rem', lineHeight: 1 }} aria-hidden="true">⚠️</span>
            <h2 id="logout-confirm-title" className="modal-title">
              Unresolved Food Scan
            </h2>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onCancel}
            aria-label="Close"
            disabled={isSaving}
            title="Cancel (Escape)"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            You scanned <strong>"{productName}"</strong> without deciding whether to record it to your daily intake ledger.
          </p>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
            Did you consume this food item before logging out?
          </p>

          {errorMessage && (
            <div style={{ marginBottom: '0.75rem' }}>
              <StatusAlert
                type="error"
                title="Failed to Save Consumption Record"
                message={errorMessage}
                onRetry={handleSaveAndLogout}
                retryLabel="Retry Save"
                onDismiss={() => setErrorMessage(null)}
              />
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
