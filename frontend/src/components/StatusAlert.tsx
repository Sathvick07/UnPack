import React from 'react';

export type StatusAlertType = 'error' | 'warning' | 'info' | 'success';

export interface StatusAlertProps {
  type: StatusAlertType;
  title: string;
  message?: string | React.ReactNode;
  evidenceNote?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  className?: string;
  id?: string;
}

const TYPE_CONFIG = {
  error: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    badge: 'Error',
    role: 'alert',
    ariaLive: 'assertive' as const,
    containerClass: 'status-alert-error',
  },
  warning: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    badge: 'Warning',
    role: 'alert',
    ariaLive: 'polite' as const,
    containerClass: 'status-alert-warning',
  },
  info: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    badge: 'Notice',
    role: 'status',
    ariaLive: 'polite' as const,
    containerClass: 'status-alert-info',
  },
  success: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    badge: 'Success',
    role: 'status',
    ariaLive: 'polite' as const,
    containerClass: 'status-alert-success',
  },
};

/**
 * Filter out sensitive backend stack traces or database errors
 */
function sanitizeErrorMessage(msg: string): string {
  if (
    msg.includes('Traceback (most recent call last)') ||
    msg.includes('django.db') ||
    msg.includes('psycopg2') ||
    msg.includes('sqlite3.OperationalError') ||
    msg.includes('Internal Server Error')
  ) {
    return 'An unexpected server issue occurred while processing your request. Please retry in a few moments.';
  }
  return msg;
}

export const StatusAlert: React.FC<StatusAlertProps> = ({
  type,
  title,
  message,
  evidenceNote,
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  action,
  className = '',
  id,
}) => {
  const config = TYPE_CONFIG[type];

  const processedMessage =
    typeof message === 'string' ? sanitizeErrorMessage(message) : message;

  return (
    <div
      id={id}
      role={config.role}
      aria-live={config.ariaLive}
      className={`status-alert ${config.containerClass} ${className}`.trim()}
    >
      <div className="status-alert-icon-wrapper" aria-hidden="true">
        {config.icon}
      </div>

      <div className="status-alert-content">
        <div className="status-alert-header">
          <h4 className="status-alert-title">{title}</h4>
          <span className="status-alert-badge">{config.badge}</span>
        </div>

        {processedMessage && (
          <div className="status-alert-message">
            {typeof processedMessage === 'string' ? (
              <p>{processedMessage}</p>
            ) : (
              processedMessage
            )}
          </div>
        )}

        {evidenceNote && (
          <div className="status-alert-evidence">
            <span className="evidence-label" aria-hidden="true">
              🔎 Evidence Note:
            </span>
            <span className="evidence-text">{evidenceNote}</span>
          </div>
        )}

        {(onRetry || action) && (
          <div className="status-alert-actions">
            {onRetry && (
              <button
                type="button"
                className="btn btn-sm btn-alert-retry"
                onClick={onRetry}
              >
                🔄 {retryLabel}
              </button>
            )}
            {action && (
              <button
                type="button"
                className={`btn btn-sm ${
                  action.variant === 'primary'
                    ? 'btn-primary'
                    : action.variant === 'outline'
                    ? 'btn-outline'
                    : 'btn-secondary'
                }`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          className="status-alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
};
