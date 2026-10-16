import React, { useState, useEffect, useCallback } from 'react';
import { AppPage } from '../types/navigation';
import { DailyIntakeSummary, NutrientTotalItem, ConfirmedIntakeItem } from '../types/nutrition';
import { useAuth } from '../context/AuthContext';
import {
  fetchDailyIntakeSummary,
  updateConsumptionRecord,
  deleteConsumptionRecord,
} from '../api/client';

interface NutritionPageProps {
  onNavigate: (page: AppPage) => void;
}

export const NutritionPage: React.FC<NutritionPageProps> = ({ onNavigate }) => {
  const { token, isAuthenticated } = useAuth();

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
      setErrorMessage(err.message || 'Failed to load daily intake summary.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSummary(selectedDate);
  }, [selectedDate, loadSummary]);

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  const formattedDisplayDate = (() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(dateObj);
    } catch {
      return selectedDate;
    }
  })();

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
          <h1 className="page-title">Daily Confirmed Intake</h1>
          <p className="page-subtitle">
            Accurate nutritional accumulation calculated strictly from foods you explicitly confirm consuming.
          </p>
        </div>

        <div className="empty-state-card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <div className="empty-state-icon">🔒</div>
          <h3 className="empty-state-title">Sign In to Track Daily Intake</h3>
          <p className="empty-state-text">
            Confirmed nutritional tracking requires a secure account so your daily ledger, reference percentages,
            and multi-product alerts persist across your devices.
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

  // Key Spotlight Nutrients
  const keyNutrientKeys = ['energy', 'sodium', 'protein', 'added_sugars', 'saturated_fat', 'dietary_fibre'];

  return (
    <div className="page-content nutrition-page">
      <div className="page-header">
        <div className="brand-badge">Nutrition & Intake Ledger</div>
        <h1 className="page-title">Daily Confirmed Intake</h1>
        <p className="page-subtitle">
          Accurate nutritional accumulation calculated strictly from foods you explicitly confirm consuming.
        </p>
      </div>

      {/* Date Navigation Strip */}
      <div
        className="date-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <span className="calendar-icon">📅</span>
            <span className="date-text" style={{ fontWeight: 700 }}>{formattedDisplayDate}</span>
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

        <div className="ledger-rule-badge">
          <span>Rule: Preview ≠ Consumption</span>
        </div>
      </div>

      {actionSuccessMsg && (
        <div
          style={{
            background: 'rgba(132, 204, 22, 0.12)',
            border: '1px solid rgba(132, 204, 22, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            margin: '1rem 0',
            color: 'var(--color-lime)',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          ✓ {actionSuccessMsg}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            margin: '1rem 0',
            color: '#f87171',
            fontSize: '0.88rem',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: 'var(--text-muted)',
            fontSize: '0.92rem',
          }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>⏳</div>
          <div>Loading confirmed intake records for {formattedDisplayDate}...</div>
        </div>
      )}

      {/* Multi-Product Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🚨</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
              Daily Nutrient Intake Alerts ({alerts.length})
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

                {/* Visual Progress Bar */}
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

      {/* Incomplete Data Callout */}
      {hasIncomplete && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            margin: '1rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>Notice: Incomplete Product Label Data.</strong> Some foods consumed today omitted certain nutrition facts.
            Total accumulation for those nutrients may be partial rather than zero.
          </div>
        </div>
      )}

      {/* Key Macronutrient Cards */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          Key Daily Reference Benchmarks
        </h3>
        <div className="metrics-grid">
          {keyNutrientKeys.map((k) => {
            const item: NutrientTotalItem | undefined = nutrients[k];
            if (!item) return null;

            const isMissing = item.amount === null;
            const pct = item.percentage;
            const ref = item.reference;

            return (
              <div key={k} className="metric-card">
                <div className="metric-header">
                  <span className="metric-label">{item.display_name}</span>
                  <span className="metric-unit">{item.unit}</span>
                </div>

                <div className="metric-value">
                  {isMissing ? (
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Unavailable</span>
                  ) : (
                    item.amount
                  )}
                </div>

                {/* Progress bar if percentage available */}
                {pct !== null && (
                  <div style={{ margin: '0.4rem 0' }}>
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
                          background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f97316' : 'var(--brand-primary)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="metric-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-target">
                    {pct !== null
                      ? `${pct}% of ${ref?.daily_reference_amount} ${item.unit}`
                      : item.percentage_message}
                  </span>
                  {item.is_incomplete && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#eab308',
                        background: 'rgba(234, 179, 8, 0.15)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                      }}
                      title="Some products lacked this nutrient"
                    >
                      Partial
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmed Food Items List for this Date */}
      <div style={{ margin: '2rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Confirmed Foods Consumed ({items.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Items explicitly confirmed by you on {formattedDisplayDate}.
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
            <div className="empty-state-icon">🥗</div>
            <h3 className="empty-state-title">No Confirmed Food Items on {formattedDisplayDate}</h3>
            <p className="empty-state-text">
              Unpack never fabricates consumption history or invents placeholder meals.
              To add an item to your daily ledger, scan a label, preview the nutrient contribution
              for your portion, and tap <strong>Record Consumption</strong>.
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
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <span style={{ fontSize: '0.86rem', color: '#f87171' }}>
                        Are you sure you want to remove <strong>"{item.product_name}"</strong> from today's ledger?
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: '#ef4444', color: '#fff' }}
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

                  {/* Item Nutrient Pills */}
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

      {/* Comprehensive 15-Nutrient Reference Table */}
      <div style={{ margin: '2rem 0' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
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
                <th style={{ width: '20%', textAlign: 'right' }}>Confirmed Intake</th>
                <th style={{ width: '22%', textAlign: 'right' }}>Daily Reference</th>
                <th style={{ width: '18%', textAlign: 'right' }}>% Reference</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Data Quality</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(nutrients).map(([k, item]: [string, NutrientTotalItem], idx) => {
                const isMissing = item.amount === null;
                const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

                return (
                  <tr key={k} className={rowClass}>
                    <td className="cell-nutrient">
                      <strong className="nutrient-label">{item.display_name}</strong>
                    </td>

                    <td className="cell-value" style={{ textAlign: 'right' }}>
                      {isMissing ? (
                        <span className="badge-missing">Amount unavailable</span>
                      ) : (
                        <span className="val-text">
                          <strong>{item.amount}</strong> <span className="unit-text">{item.unit}</span>
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {item.reference?.daily_reference_amount !== null && item.reference?.daily_reference_amount !== undefined ? (
                        <span>
                          {item.reference.daily_reference_amount} {item.reference.unit}
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
                            color: item.percentage >= 100 ? '#ef4444' : item.percentage >= 80 ? '#f97316' : 'var(--brand-primary)',
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

                    <td style={{ textAlign: 'center' }}>
                      {item.is_incomplete ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#eab308',
                            background: 'rgba(234, 179, 8, 0.15)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontWeight: 600,
                          }}
                          title={`Missing from: ${item.missing_products.join(', ')}`}
                        >
                          Partial
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-lime)',
                            background: 'var(--color-lime-bg)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontWeight: 600,
                          }}
                        >
                          Complete
                        </span>
                      )}
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
            <p>Scanning or previewing a label does not alter your intake history. You must deliberately confirm consumption.</p>
          </div>
          <div className="info-box-item">
            <strong>2. Basis & Unit Preservation</strong>
            <p>Nutrients are calculated per serving or per 100g strictly based on what the manufacturer label states and your confirmed portions.</p>
          </div>
          <div className="info-box-item">
            <strong>3. Missing Data ≠ Zero</strong>
            <p>If a label omits a nutrient fact (e.g. trans fat or added sugars), it is recorded as missing or unreported, never coerced into zero.</p>
          </div>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          * {summary?.reference_system?.disclaimer || 'Reference benchmarks are based on FSSAI 2020 / ICMR-NIN 2020 adult guidelines. These general educational references do not replace individual medical or dietary advice.'}
        </p>
      </div>
    </div>
  );
};
