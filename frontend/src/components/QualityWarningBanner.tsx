import React from 'react';
import { ImageQualityInfo } from '../types/label';

interface QualityWarningBannerProps {
  quality: ImageQualityInfo;
  onRetake?: () => void;
}

export const QualityWarningBanner: React.FC<QualityWarningBannerProps> = ({
  quality,
  onRetake,
}) => {
  const isUnclear = quality.quality_tier === 'UNCERTAIN' || quality.quality_tier === 'UNREADABLE';
  const tierColors: Record<string, string> = {
    CLEAR: '#10b981',
    MODERATE: '#f59e0b',
    UNCERTAIN: '#f97316',
    UNREADABLE: '#ef4444',
  };

  return (
    <div className={`quality-banner tier-${quality.quality_tier.toLowerCase()}`}>
      <div className="quality-banner-header">
        <div className="quality-tier-indicator">
          <span
            className="quality-badge"
            style={{ backgroundColor: tierColors[quality.quality_tier] }}
          >
            {quality.quality_tier}
          </span>
          {quality.is_curved_surface && (
            <span
              className="quality-badge"
              style={{ backgroundColor: '#8b5cf6' }}
              title="Cylindrical surface illumination gradient detected"
            >
              Curved Packaging
            </span>
          )}
          <span className="quality-score-text">
            Clarity Score: <strong>{quality.quality_score}/100</strong>
          </span>
          <span className="quality-dims">
            ({quality.width}x{quality.height}px • {quality.aspect_ratio}:1 aspect)
          </span>
        </div>

        {onRetake && isUnclear && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onRetake}>
            Retake Photo
          </button>
        )}
      </div>

      {quality.warnings.length > 0 && (
        <div className="quality-warnings-list">
          <div className="warnings-label">⚠️ Detected Label Image Issues:</div>
          <ul>
            {quality.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {quality.retake_recommendations.length > 0 && isUnclear && (
        <div className="quality-recommendations-list">
          <div className="recommendations-label">💡 Guided Tips for a Clearer Scan:</div>
          <ul>
            {quality.retake_recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
