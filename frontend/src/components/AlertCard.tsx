import React from 'react';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertEvidenceItem {
  label: string;
  text: string;
}

export interface AlertCardProps {
  id?: string;
  icon: React.ReactNode | string;
  title: string;
  statusLabel: string;
  severity: AlertSeverity;
  affectedItem?: string;
  affectedItemLabel?: string;
  explanation: string;
  evidence?: string | AlertEvidenceItem[];
  evidenceLabel?: string;
  actions?: React.ReactNode;
  targetSectionId?: string;
  onNavigate?: (sectionId: string) => void;
  className?: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  id,
  icon,
  title,
  statusLabel,
  severity,
  affectedItem,
  affectedItemLabel = 'Target Item',
  explanation,
  evidence,
  evidenceLabel = 'Physical Label Evidence',
  actions,
  targetSectionId,
  onNavigate,
  className = '',
}) => {
  const isNavigable = !!targetSectionId && !!onNavigate;

  const handleCardClick = () => {
    if (isNavigable && targetSectionId) {
      onNavigate(targetSectionId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && isNavigable && targetSectionId) {
      // Don't trigger if user was typing in an input or focused on a button
      if ((e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        onNavigate(targetSectionId);
      }
    }
  };

  return (
    <div
      id={id}
      className={`alert-card alert-card-${severity} ${isNavigable ? 'is-navigable' : ''} ${className}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={isNavigable ? 0 : undefined}
      role={isNavigable ? 'button' : 'region'}
      aria-label={
        isNavigable
          ? `${title} - ${statusLabel}. Click to jump to analysis section.`
          : `${title} - ${statusLabel}`
      }
    >
      {/* 1. Header: Icon, Title, Affected Item, Status Pill */}
      <div className="alert-card-header">
        <div className="alert-card-title-group">
          <span className="alert-card-icon" aria-hidden="true">
            {icon}
          </span>
          <div className="alert-card-headings">
            <h5 className="alert-card-title">{title}</h5>
            {affectedItem && (
              <span className="alert-card-affected-item" title={`${affectedItemLabel}: ${affectedItem}`}>
                <span className="affected-item-prefix">{affectedItemLabel}:</span>{' '}
                <strong className="affected-item-name">{affectedItem}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="alert-card-badge-wrap">
          <span className={`alert-card-status-pill status-${severity}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* 2. Short Explanation */}
      <p className="alert-card-explanation">{explanation}</p>

      {/* 3. Supporting Evidence Snippet(s) */}
      {evidence && (
        <div className="alert-card-evidence-section">
          {typeof evidence === 'string' ? (
            <div className="alert-card-evidence-box">
              <span className="evidence-header-tag">{evidenceLabel}:</span>
              <blockquote className="evidence-quote">"{evidence}"</blockquote>
            </div>
          ) : Array.isArray(evidence) && evidence.length > 0 ? (
            <div className="alert-card-evidence-compare-list">
              {evidence.map((item, idx) => (
                <div key={idx} className="evidence-compare-item">
                  <span className="evidence-compare-tag">{item.label}:</span>
                  <span className="evidence-compare-text">"{item.text}"</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* 4. Action Controls (if applicable) */}
      {actions && (
        <div
          className="alert-card-actions"
          onClick={(e) => {
            // Stop propagation to prevent card-level navigation click
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            // Stop propagation so space/enter on buttons don't fire card navigation
            e.stopPropagation();
          }}
        >
          {actions}
        </div>
      )}

      {/* 5. Navigation Cue / Anchor indicator */}
      {isNavigable && (
        <div className="alert-card-footer-nav" aria-hidden="true">
          <span className="nav-hint-text">
            <span>Jump to verified section</span>
            <span className="nav-hint-arrow">→</span>
          </span>
        </div>
      )}
    </div>
  );
};
