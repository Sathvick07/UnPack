import React, { useState, useEffect } from 'react';
import { DailyIntakeSummary, NutrientTotalItem } from '../types/nutrition';
import { fetchDailyIntakeSummary } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface DailyIntakeProgressSectionProps {
  onNavigateToLedger?: () => void;
  refreshTrigger?: number;
}

// Predefined fallback reference standards (FSSAI 2020 2,000 kcal diet)
// Used when backend response limits are loading or guest mode
const DEFAULT_PREDEFINED_LIMITS: Record<
  string,
  { name: string; limit: number; unit: string; isUpperLimit: boolean }
> = {
  sodium: { name: 'Sodium', limit: 2000, unit: 'mg', isUpperLimit: true },
  saturated_fat: { name: 'Saturated Fat', limit: 22, unit: 'g', isUpperLimit: true },
  sugars: { name: 'Total Sugars', limit: 50, unit: 'g', isUpperLimit: true },
  fat: { name: 'Total Fat', limit: 67, unit: 'g', isUpperLimit: true },
  energy: { name: 'Energy', limit: 2000, unit: 'kcal', isUpperLimit: false },
  protein: { name: 'Protein', limit: 54, unit: 'g', isUpperLimit: false },
  carbohydrates: { name: 'Carbohydrates', limit: 300, unit: 'g', isUpperLimit: false },
};

export const DailyIntakeProgressSection: React.FC<DailyIntakeProgressSectionProps> = ({
  onNavigateToLedger,
  refreshTrigger,
}) => {
  const { token, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<DailyIntakeSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadTodayIntake() {
      setIsLoading(true);
      setIsError(false);
      try {
        const data = await fetchDailyIntakeSummary(undefined, token || undefined);
        if (isMounted) {
          setSummary(data);
        }
      } catch (err) {
        console.warn('Could not load daily intake summary:', err);
        if (isMounted) {
          setIsError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTodayIntake();
    return () => {
      isMounted = false;
    };
  }, [token, refreshTrigger]);

  const confirmedCount = summary?.total_products_confirmed || 0;
  const totals = summary?.nutrient_totals || {};

  // Supported nutrients to display in the compact dashboard
  const trackedKeys = ['sodium', 'saturated_fat', 'sugars', 'total_fat', 'energy', 'protein', 'carbohydrates'];

  return (
    <div className="card-panel daily-intake-compact-card">
      <div className="panel-header">
        <div className="header-title-group">
          <span className="header-icon" aria-hidden="true">📈</span>
          <div>
            <h3 className="panel-title">Daily Intake & Reference Limits</h3>
            <span className="section-label" style={{ display: 'block', marginTop: '2px' }}>
              Confirmed Foods Today: {confirmedCount} {confirmedCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {onNavigateToLedger && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNavigateToLedger}
            title="Open comprehensive daily intake ledger"
          >
            Full Ledger →
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="intake-loading-skeleton">
          <span>Loading today's confirmed nutritional intake...</span>
        </div>
      ) : isError || !isAuthenticated ? (
        <div className="intake-guest-notice">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span>ℹ️</span>
            <strong>Daily Limit Tracking</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Sign in to automatically accumulate your confirmed food intake against FSSAI 2020 daily limits.
          </p>
        </div>
      ) : confirmedCount === 0 ? (
        <div className="intake-empty-compact">
          <span className="empty-icon" style={{ fontSize: '1.4rem' }}>🥗</span>
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              No foods confirmed consumed today
            </strong>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              When you eat or drink a scanned product, use "Record Consumption" above to log portions to your daily ledger.
            </p>
          </div>
        </div>
      ) : (
        <div className="intake-nutrients-grid">
          {trackedKeys.map((key) => {
            const normalizedKey = key === 'total_fat' ? 'fat' : key;
            const backendTotal: NutrientTotalItem | undefined = totals[key] || totals[normalizedKey];
            const fallbackConfig = DEFAULT_PREDEFINED_LIMITS[normalizedKey];

            const displayName =
              backendTotal?.display_name || fallbackConfig?.name || key.replace('_', ' ');
            const unit = backendTotal?.unit || fallbackConfig?.unit || 'g';

            // Consumed amount
            const consumedAmount = backendTotal?.amount;
            const hasAmount = consumedAmount !== null && consumedAmount !== undefined;

            // Reference limit
            const referenceAmount =
              backendTotal?.reference?.daily_reference_amount || fallbackConfig?.limit || null;
            const isUpperLimit =
              backendTotal?.reference?.is_upper_limit ?? fallbackConfig?.isUpperLimit ?? true;

            // Percentage
            const pct =
              backendTotal?.percentage ??
              (hasAmount && referenceAmount ? (consumedAmount / referenceAmount) * 100 : null);

            // Remaining amount (only when both consumed amount and reference amount are available)
            let remainingText = '';
            if (hasAmount && referenceAmount !== null) {
              const diff = referenceAmount - consumedAmount;
              if (diff >= 0) {
                remainingText = `${diff.toFixed(diff >= 10 ? 0 : 1)} ${unit} ${isUpperLimit ? 'remaining' : 'to daily target'}`;
              } else {
                remainingText = `Exceeded by ${Math.abs(diff).toFixed(diff <= -10 ? 0 : 1)} ${unit}`;
              }
            } else {
              remainingText = '—';
            }

            // Progress bar color
            const barPct = pct !== null ? Math.min(Math.max(pct, 0), 100) : 0;
            const isExceeded = pct !== null && pct > 100;
            const isWarning = pct !== null && pct >= 70 && pct <= 100;

            const barColorClass = isExceeded
              ? 'bar-exceeded'
              : isWarning
              ? 'bar-warning'
              : 'bar-normal';

            return (
              <div key={key} className="intake-nutrient-row">
                <div className="nutrient-info-line">
                  <div className="nutrient-title-block">
                    <strong className="nutrient-name">{displayName}</strong>
                    {backendTotal?.is_incomplete && (
                      <span className="incomplete-asterisk" title="Some consumed items omitted this nutrient on their label">
                        *
                      </span>
                    )}
                  </div>
                  <div className="nutrient-consumed-stat">
                    {hasAmount ? (
                      <span>
                        <strong>{consumedAmount.toFixed(consumedAmount >= 10 ? 0 : 1)}</strong>{' '}
                        <span className="unit-label">{unit}</span>
                      </span>
                    ) : (
                      <span className="val-unknown">Unknown</span>
                    )}
                    {referenceAmount !== null ? (
                      <span className="reference-stat"> / {referenceAmount} {unit}</span>
                    ) : (
                      <span className="reference-stat"> (Ref unavail)</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="intake-progress-track">
                  <div
                    className={`intake-progress-fill ${barColorClass}`}
                    style={{ width: `${barPct}%` }}
                    role="progressbar"
                    aria-valuenow={pct !== null ? Math.round(pct) : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                <div className="nutrient-sub-line">
                  <span className="percentage-text">
                    {pct !== null ? `${Math.round(pct)}% of daily reference` : 'Limit unavailable'}
                  </span>
                  <span className={`remaining-text ${isExceeded ? 'text-exceeded' : ''}`}>
                    {remainingText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmed items list from today */}
      {summary && summary.items && summary.items.length > 0 && (
        <div className="today-items-preview">
          <span className="today-items-label">Confirmed today ({summary.items.length}):</span>
          <div className="today-items-tags">
            {summary.items.map((item) => (
              <span key={item.id} className="today-item-chip">
                🍽️ {item.product_name} ({item.servings_consumed} {item.servings_consumed === 1 ? 'serving' : 'servings'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="intake-disclaimer-note">
        <span>ℹ️</span>
        <p>
          Reference values based on FSSAI ICMR 2020 daily standards for general adults (2,000 kcal diet). General reference values do not replace personalized medical advice. Remaining below daily reference limits does not guarantee health or food safety.
        </p>
      </div>
    </div>
  );
};
