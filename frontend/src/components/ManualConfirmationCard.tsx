import React from 'react';
import { CompatibilityFinding } from '../types/label';

interface ManualConfirmationCardProps {
  finding: CompatibilityFinding;
  onConfirmConflict: (restriction: string) => void;
  onConfirmSafe: (restriction: string) => void;
  onRetake: () => void;
}

export const ManualConfirmationCard: React.FC<ManualConfirmationCardProps> = ({
  finding,
  onConfirmConflict,
  onConfirmSafe,
  onRetake,
}) => {
  const restriction = finding.restriction || 'unspecified allergen';

  return (
    <div className="manual-confirm-card">
      <div className="confirm-icon">⚠️</div>
      <div className="confirm-body">
        <h4 className="confirm-title">Manual Confirmation Requested</h4>
        <p className="confirm-desc">
          The packaging image contains obscured, blurry, or missing text. We cannot automatically
          verify whether this product is free from <strong>{restriction}</strong>.
        </p>
        <div className="confirm-evidence-box">
          <span className="evidence-tag">Observed Uncertainty:</span>
          <span>{finding.explanation}</span>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => onConfirmConflict(restriction)}
          >
            I Checked: It CONTAINS {restriction}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => onConfirmSafe(restriction)}
          >
            I Checked: It is FREE from {restriction}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onRetake}
          >
            Retake Clearer Photo
          </button>
        </div>
      </div>
    </div>
  );
};
