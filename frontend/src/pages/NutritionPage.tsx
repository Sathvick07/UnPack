import React, { useState, useEffect, useCallback } from 'react';
import { AppPage } from '../types/navigation';
import { DailyIntakeSummary, NutrientTotalItem, ConfirmedIntakeItem } from '../types/nutrition';
import { useAuth } from '../context/AuthContext';
import {
  fetchDailyIntakeSummary,
  updateConsumptionRecord,
  deleteConsumptionRecord,
} from '../api/client';
import { getLocalDateString, formatDisplayDate, shiftLocalDate } from '../utils/date';
import { StatusAlert } from '../components/StatusAlert';

interface NutritionPageProps {
  onNavigate: (page: AppPage) => void;
}

export const NutritionPage: React.FC<NutritionPageProps> = ({ onNavigate }) => {
  const { token, isAuthenticated } = useAuth();

  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [summary, setSummary] = useState<DailyIntakeSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Editing state for item portions
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingServings, setEditingServings] = useState<number>(1.0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Deleting confirmation
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  const loadSummary = useCallback(async (dateToLoad: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDailyIntakeSummary(dateToLoad, token || undefined);
      setSummary(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load daily intake summary. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Load summary on selectedDate or token change
  useEffect(() => {
    loadSummary(selectedDate);
  }, [selectedDate, loadSummary]);

  // Reactive listener: automatically synchronize if a consumption event is recorded elsewhere
  useEffect(() => {
    const handleConsumptionRecorded = (e: Event) => {
      const customEvent = e as CustomEvent<{ date?: string }>;
      if (customEvent.detail?.date) {
        setSelectedDate(customEvent.detail.date);
        loadSummary(customEvent.detail.date);
      } else {
        loadSummary(selectedDate);
      }
    };

    window.addEventListener('unpack:consumption-recorded', handleConsumptionRecorded);
    return () => {
      window.removeEventListener('unpack:consumption-recorded', handleConsumptionRecorded);
    };
  }, [loadSummary, selectedDate]);

  const handlePrevDay = () => {
    setSelectedDate((curr) => shiftLocalDate(curr, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((curr) => shiftLocalDate(curr, 1));
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  const formattedDisplayDate = formatDisplayDate(selectedDate);
  const isToday = selectedDate === todayStr;

  const handleSaveEditPortion = async (item: ConfirmedIntakeItem) => {
    if (!token || editingServings <= 0) return;
    setIsUpdating(true);
    try {
      await updateConsumptionRecord(item.id, { servings_consumed: editingServings }, token);
      setEditingItemId(null);
      setActionSuccessMsg(`Updated portion for "${item.product_name}" to ${editingServings} serving(s).`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSummary(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update item portion.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItem = async (item: ConfirmedIntakeItem) => {
    if (!token) return;
    setIsUpdating(true);
    try {
      await deleteConsumptionRecord(item.id, token);
      setDeletingItemId(null);
      setActionSuccessMsg(`Removed "${item.product_name}" from intake ledger.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSummary(selectedDate);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete record.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="page-content nutrition-page">
        <div className="page-header">
          <div className="brand-badge">Nutrition & Intake Ledger</div>
          <h1 className="page-title">Daily Intake & Reference Limits</h1>
          <p className="page-subtitle">
            Accurate nutritional accumulation calculated strictly from foods you explicitly confirm consuming.
          </p>
        </div>

        <div className="empty-state-card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <div className="empty-state-icon" aria-hidden="true">🔒</div>
          <h3 className="empty-state-title">Sign In to Track Daily Intake</h3>
          <p className="empty-state-text">
            Confirmed nutritional tracking requires an account so your daily ledger, reference percentages,
            and multi-product alerts persist securely across your devices.
          </p>
          <div className="empty-state-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('login')}
            >
              Log In
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate('register')}
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nutrients = summary?.nutrient_totals || {};
  const alerts = summary?.alerts || [];
  const items = summary?.items || [];
  const hasIncomplete = summary?.has_incomplete_data || false;

  // Key spotlight nutrients
  const keyNutrientKeys = [
    'energy',
    'sodium',
    'protein',
    'added_sugars',
    'saturated_fat',
    'total_fat',
    'carbohydrates',
    'dietary_fibre',
  ];

  return (
    <div className="page-content nutrition-page">
      <div className="page-header">
        <div className="brand-badge">Nutrition & Intake Ledger</div>
        <h1 className="page-title">Daily Confirmed Intake</h1>
        <p className="page-subtitle">
          Accurate nutritional accumulation calculated strictly from foods you explicitly confirm consuming.
        </p>
      </div>

      {/* Date Navigation & Status Bar */}
      <div
        className="date-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--bg-card)',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrevDay}
            aria-label="Previous day"
            title="Previous Day"
          >
            ◀
          </button>

          <div className="date-display" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="calendar-icon" aria-hidden="true">📅</span>
            <span className="date-text" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {formattedDisplayDate}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleNextDay}
            aria-label="Next day"
            title="Next Day"
          >
            ▶
          </button>

          {!isToday && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleToday}
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
            >
              Today
            </button>
          )}

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="text-input"
            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
            aria-label="Select custom date"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="status-pill pill-neutral" style={{ fontSize: '0.78rem' }}>
            Rule: Preview ≠ Consumption
          </span>
          <span className="badge-pill">
            {items.length} {items.length === 1 ? 'Food' : 'Foods'} Logged
          </span>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMsg && (
        <StatusAlert
          type="success"
          title="Intake Ledger Updated"
          message={actionSuccessMsg}
          onDismiss={() => setActionSuccessMsg(null)}
        />
      )}

      {/* Error Alert */}
      {errorMessage && (
        <StatusAlert
          type="error"
          title="Failed to Load Daily Summary"
          message={errorMessage}
          onRetry={() => loadSummary(selectedDate)}
          retryLabel="Retry"
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            color: 'var(--text-muted)',
            fontSize: '0.92rem',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }} aria-hidden="true">⏳</div>
          <div>Loading confirmed intake records for <strong>{formattedDisplayDate}</strong>...</div>
        </div>
      )}

      {/* Multi-Product Alerts Banner */}
      {!isLoading && alerts.length > 0 && (
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }} aria-hidden="true">🚨</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
              Daily Reference Intake Alerts ({alerts.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        background: alert.severity === 'CRITICAL' ? '#ef4444' : '#f97316',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      {alert.severity}
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{alert.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f87171' }}>
                    {alert.current_amount} {alert.unit} ({alert.percentage}% of {alert.reference_amount} {alert.unit})
                  </span>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    height: '8px',
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    margin: '0.5rem 0',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(alert.percentage, 100)}%`,
                      background: alert.percentage >= 100 ? '#ef4444' : '#f97316',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0.35rem 0' }}>
                  {alert.message}
                </p>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  ℹ️ {alert.disclaimer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete Data Notice */}
      {!isLoading && hasIncomplete && (
        <div style={{ marginBottom: '1.5rem' }}>
          <StatusAlert
            type="warning"
            title="Incomplete Product Nutrition Data"
            message="Some foods confirmed consumed today omitted certain nutrition facts on their packaging. Totals for those nutrients reflect available data rather than zero."
            evidenceNote="Absence of a declared nutrient value on a label is preserved as 'Not provided' and never fabricated into 0."
          />
        </div>
      )}

      {/* Section 1: Key Daily Reference Benchmarks Card Grid */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Key Daily Reference Benchmarks
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Benchmarks based on FSSAI 2020 / ICMR 2020 adult guidelines (2,000 kcal diet). General educational references only.
            </span>
          </div>
        </div>

        <div className="metrics-grid">
          {keyNutrientKeys.map((k) => {
            const item: NutrientTotalItem | undefined = nutrients[k];
            if (!item) return null;

            const isMissing = item.amount === null;
            const pct = item.percentage;
            const ref = item.reference;
            const refAmt = ref?.daily_reference_amount;
            const consumedAmt = item.amount;
            const hasAmount = !isMissing && consumedAmt !== null;
            const hasRef = refAmt !== null && refAmt !== undefined;

            // Calculate remaining amount strictly when both consumed and reference exist
            let remainingLabel = '—';
            if (hasAmount && hasRef && consumedAmt !== null && refAmt !== null && refAmt !== undefined) {
              const diff = refAmt - consumedAmt;
              if (diff >= 0) {
                remainingLabel = `${diff.toFixed(diff >= 10 ? 0 : 1)} ${item.unit} remaining`;
              } else {
                remainingLabel = `Exceeded by ${Math.abs(diff).toFixed(diff <= -10 ? 0 : 1)} ${item.unit}`;
              }
            }

            return (
              <div key={k} className="metric-card">
                <div className="metric-header">
                  <span className="metric-label">{item.display_name}</span>
                  <span className="metric-unit">{item.unit}</span>
                </div>

                <div className="metric-value">
                  {isMissing || consumedAmt === null ? (
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)' }}>Unavailable</span>
                  ) : (
                    <span>
                      {consumedAmt.toFixed(consumedAmt >= 10 ? 0 : 1)}{' '}
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {item.unit}
                      </span>
                    </span>
                  )}
                </div>

                {/* Progress bar if percentage available */}
                {pct !== null ? (
                  <div style={{ margin: '0.5rem 0' }}>
                    <div
                      style={{
                        height: '6px',
                        width: '100%',
                        background: 'var(--bg-secondary)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(pct, 100)}%`,
                          background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f97316' : 'var(--color-lime)',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease',
                        }}
                        role="progressbar"
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '6px', margin: '0.5rem 0' }} />
                )}

                <div className="metric-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-target">
                    {pct !== null && hasRef && ref
                      ? `${pct}% of ${ref.daily_reference_amount} ${item.unit}`
                      : item.percentage_message || 'Reference unconfigured'}
                  </span>
                  {hasAmount && hasRef && (
                    <span style={{ fontSize: '0.75rem', color: pct !== null && pct > 100 ? '#f87171' : 'var(--text-secondary)' }}>
                      {remainingLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Confirmed Food Items List for this Date */}
      <div style={{ margin: '2rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Confirmed Foods Consumed ({items.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Foods explicitly confirmed by you on {formattedDisplayDate}.
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('scan')}
          >
            + Scan & Record Food
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon" aria-hidden="true">🥗</div>
            <h3 className="empty-state-title">No Confirmed Food Items on {formattedDisplayDate}</h3>
            <p className="empty-state-text">
              Unpack never fabricates consumption history or invents placeholder meals.
              To record what you eat or drink, scan a label, inspect the nutrient contribution, and tap <strong>Record Consumption</strong>.
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              const isConfirmingDelete = deletingItemId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {item.product_name}
                      </h4>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Portion: <strong>{item.servings_consumed} serving{item.servings_consumed !== 1 ? 's' : ''}</strong>
                        {item.serving_size ? ` (${item.serving_size})` : ''} • Basis: {item.basis_used === 'per_serving' ? 'Per Serving' : 'Per 100g'}
                        {item.consumption_time && ` • Logged at ${new Date(item.consumption_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {!isEditing && !isConfirmingDelete && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingServings(item.servings_consumed);
                            }}
                          >
                            ✏️ Edit Portion
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setDeletingItemId(item.id)}
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline Portion Editor */}
                  {isEditing && (
                    <div
                      style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Adjust Servings Consumed:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="20"
                        className="text-input"
                        style={{ width: '90px' }}
                        value={editingServings}
                        onChange={(e) => setEditingServings(parseFloat(e.target.value) || 0)}
                        disabled={isUpdating}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEditPortion(item)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Saving...' : 'Save & Recalculate'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingItemId(null)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Delete Confirmation Box */}
                  {isConfirmingDelete && (
                    <div
                      className="confirm-prompt-box prompt-danger"
                      style={{
                        background: 'var(--status-error-bg)',
                        border: '1px solid var(--status-error-border)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.65rem',
                      }}
                    >
                      <span style={{ fontSize: '0.86rem', color: 'var(--status-error-text)' }}>
                        Remove <strong>"{item.product_name}"</strong> from today's ledger?
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteItem(item)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? 'Removing...' : 'Confirm Remove'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDeletingItemId(null)}
                          disabled={isUpdating}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Item Nutrient Contribution Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {Object.entries(item.nutrients).map(([k, n]) => {
                      if (n.is_missing || n.amount === null) return null;
                      return (
                        <span
                          key={k}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <strong>{k.replace(/_/g, ' ')}:</strong> {n.amount} {n.unit}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Comprehensive Nutrient Accumulation Table */}
      <div style={{ margin: '2rem 0' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Detailed Daily Accumulation & Reference Limits
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Standardized under <strong>{summary?.reference_system?.display || 'FSSAI 2020 / ICMR 2020'}</strong> benchmarks for a 2,000 kcal diet.
        </p>

        <div className="responsive-table-container">
          <table className="clean-nutrition-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Nutrient</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Confirmed Intake</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Daily Reference</th>
                <th style={{ width: '16%', textAlign: 'right' }}>% Reference</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(nutrients).map(([k, item]: [string, NutrientTotalItem], idx) => {
                const isMissing = item.amount === null;
                const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
                const ref = item.reference;
                const refAmt = ref?.daily_reference_amount;
                const consumedAmt = item.amount;
                const hasAmount = !isMissing && consumedAmt !== null;
                const hasRef = refAmt !== null && refAmt !== undefined;

                let remainingText = '—';
                if (hasAmount && hasRef && consumedAmt !== null && refAmt !== null && refAmt !== undefined) {
                  const diff = refAmt - consumedAmt;
                  if (diff >= 0) {
                    remainingText = `${diff.toFixed(diff >= 10 ? 0 : 1)} ${item.unit}`;
                  } else {
                    remainingText = `+${Math.abs(diff).toFixed(diff <= -10 ? 0 : 1)} ${item.unit} (Exceeded)`;
                  }
                }

                return (
                  <tr key={k} className={rowClass}>
                    <td className="cell-nutrient">
                      <strong className="nutrient-label">{item.display_name}</strong>
                    </td>

                    <td className="cell-value" style={{ textAlign: 'right' }}>
                      {isMissing || consumedAmt === null ? (
                        <span className="badge-missing">Amount unavailable</span>
                      ) : (
                        <span className="val-text">
                          <strong>{consumedAmt}</strong> <span className="unit-text">{item.unit}</span>
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {hasRef && ref ? (
                        <span>
                          {ref.daily_reference_amount} {ref.unit}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Daily reference not configured</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {item.percentage !== null ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: item.percentage >= 100 ? '#ef4444' : item.percentage >= 80 ? '#f97316' : 'var(--color-lime)',
                          }}
                        >
                          {item.percentage}%
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {item.status === 'unconfigured'
                            ? 'Daily reference not configured'
                            : item.status === 'no_percentage_standard'
                            ? 'Tracked without % standard'
                            : '—'}
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      <span style={{ color: hasAmount && hasRef && item.percentage && item.percentage > 100 ? '#ef4444' : 'var(--text-secondary)' }}>
                        {remainingText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Principles & Disclaimers */}
      <div className="ledger-info-box" style={{ marginTop: '2.5rem' }}>
        <h4 className="info-box-title">Intake Ledger & Reference Guidelines</h4>
        <div className="info-box-grid">
          <div className="info-box-item">
            <strong>1. Explicit Confirmation Only</strong>
            <p>Scanning or previewing a label never alters your intake history. You must deliberately confirm consumption.</p>
          </div>
          <div className="info-box-item">
            <strong>2. Basis & Serving Calculations</strong>
            <p>Nutrients are calculated per serving or per 100g strictly based on what the manufacturer label states and your confirmed portions.</p>
          </div>
          <div className="info-box-item">
            <strong>3. Missing Data ≠ Zero</strong>
            <p>If a label omits a nutrient fact, it is recorded as missing or unreported, never coerced into zero.</p>
          </div>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          * {summary?.reference_system?.disclaimer || 'Reference benchmarks are based on FSSAI 2020 / ICMR-NIN 2020 adult guidelines. These general educational references do not replace individual medical or dietary advice.'}
        </p>
      </div>
    </div>
  );
};
