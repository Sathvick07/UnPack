import React, { useState, useEffect, useRef } from 'react';
import { LabelAnalysisReport, CompatibilityFinding } from '../types/label';
import { AlertCard, AlertEvidenceItem } from './AlertCard';

interface FloatingSafetyAlertsProps {
  report: LabelAnalysisReport;
  onConfirmConflict: (restriction: string) => void;
  onConfirmSafe: (restriction: string) => void;
  onRetake: () => void;
  onNavigateToSection?: (sectionId: string, analysisId?: string) => void;
}

export const FloatingSafetyAlerts: React.FC<FloatingSafetyAlertsProps> = ({
  report,
  onConfirmConflict,
  onConfirmSafe,
  onRetake,
  onNavigateToSection,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle button handler: first click opens, next click closes
  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close when clicking outside of the alerts container/panel
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Prevent background body scroll when bottom sheet is open on small mobile devices
  useEffect(() => {
    if (isOpen && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Navigate to target section and provide visual highlight spotlight
  const handleNavigate = (sectionId: string) => {
    setIsOpen(false);

    if (onNavigateToSection) {
      onNavigateToSection(sectionId, report.file_name);
    }

    // Scroll to the targeted section and apply focus/highlight
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Target either the section card or the heading
        const sectionCard = el.closest('.analysis-section-card') || el;
        sectionCard.classList.remove('section-nav-spotlight');
        // Force reflow
        void (sectionCard as HTMLElement).offsetWidth;
        sectionCard.classList.add('section-nav-spotlight');
        setTimeout(() => {
          sectionCard.classList.remove('section-nav-spotlight');
        }, 2200);

        if (el instanceof HTMLElement) {
          el.focus({ preventScroll: true });
        }
      }
    }, 120);
  };

  // 1. Confirmed dietary conflicts (Red)
  const confirmedConflicts = report.findings.filter(
    (f) =>
      f.status === 'Confirmed conflict' ||
      f.status === 'CONFLICT DETECTED' ||
      f.result_status === 'Confirmed conflict'
  );

  // 2. Contradictions (Red/Purple)
  const contradictions = report.contradictions || [];

  // 3. Manual confirmation requests / Uncertain items (Amber)
  const manualConfirmations = report.findings.filter(
    (f) => f.requires_manual_confirmation
  );

  // 4. Precautionary cross-contact notices (Amber)
  const precautionaryNotices = report.findings.filter(
    (f) =>
      (f.status === 'Precautionary notice' ||
        f.result_status === 'Precautionary notice' ||
        f.status.includes('PRECAUTIONARY')) &&
      !f.requires_manual_confirmation
  );

  // 5. Image quality / curvature warnings
  const qualityWarnings = report.quality?.warnings || [];

  // 6. Ambiguous ingredients
  const ambiguousIngredients = report.ambiguous_ingredients || [];

  // Total unresolved alerts count requiring user attention
  const totalAlertCount =
    confirmedConflicts.length +
    contradictions.length +
    manualConfirmations.length;

  const hasCritical = confirmedConflicts.length > 0 || contradictions.length > 0;
  const hasWarning =
    manualConfirmations.length > 0 ||
    qualityWarnings.length > 0 ||
    precautionaryNotices.length > 0;

  // Visual color theme of the floating trigger icon
  const badgeTheme = hasCritical ? 'critical' : hasWarning ? 'warning' : 'info';

  return (
    <div ref={containerRef} className="floating-alerts-wrapper">
      {/* Real Toggle Button: Click 1 opens, Click 2 closes */}
      <aside aria-label="Safety alerts widget" className="floating-alerts-container">
        <button
          ref={triggerButtonRef}
          type="button"
          className={`floating-alert-trigger theme-${badgeTheme} ${isOpen ? 'active-toggled' : ''}`}
          onClick={handleToggle}
          aria-label={
            isOpen
              ? 'Close safety alerts panel'
              : `View safety alerts (${totalAlertCount} item${totalAlertCount === 1 ? '' : 's'})`
          }
          title={isOpen ? 'Click to close alerts panel' : 'Click to view alerts and verification'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="safety-alerts-panel"
        >
          <span className="floating-alert-icon" aria-hidden="true">
            {isOpen ? '✕' : hasCritical ? '⚠️' : '⚡'}
          </span>
          <span className="floating-alert-label">
            {isOpen ? 'Close' : 'Alerts'}
          </span>
          {!isOpen && totalAlertCount > 0 && (
            <span className="floating-alert-badge" aria-hidden="true">
              {totalAlertCount}
            </span>
          )}
        </button>
      </aside>

      {/* Accessible Drawer (Desktop) & Bottom Sheet (Mobile) */}
      {isOpen && (
        <div
          className="alert-sheet-backdrop"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            id="safety-alerts-panel"
            className="alert-sheet-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Indicator Handle */}
            <div className="sheet-drag-handle" aria-hidden="true" />

            {/* Header */}
            <div className="alert-sheet-header">
              <div className="alert-sheet-title-group">
                <span className="sheet-icon" aria-hidden="true">
                  {hasCritical ? '🚨' : hasWarning ? '⚠️' : 'ℹ️'}
                </span>
                <div>
                  <h3 id="alert-sheet-title" className="sheet-title">
                    Packaging Safety Alerts
                  </h3>
                  <p className="sheet-subtitle">
                    {totalAlertCount > 0
                      ? `${totalAlertCount} alert${totalAlertCount === 1 ? '' : 's'} requiring attention`
                      : 'All readable label checks evaluated'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-sheet-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close safety alerts panel"
                title="Close (Escape)"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="alert-sheet-body">
              {totalAlertCount === 0 &&
                qualityWarnings.length === 0 &&
                precautionaryNotices.length === 0 &&
                ambiguousIngredients.length === 0 && (
                  <div className="sheet-empty-state">
                    <span className="empty-icon" aria-hidden="true">
                      ✅
                    </span>
                    <h4>No Critical Hazards Flagged</h4>
                    <p>
                      No allergens or marketing contradictions were flagged in the readable
                      sections of this label.
                    </p>
                  </div>
                )}

              {/* 1. Critical Dietary Conflicts */}
              {confirmedConflicts.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title critical">
                      🛑 Confirmed Dietary Conflicts ({confirmedConflicts.length})
                    </h4>
                    <span className="section-help-text">Click card to jump to Allergen Findings</span>
                  </div>
                  <div className="sheet-items-list">
                    {confirmedConflicts.map((finding) => (
                      <AlertCard
                        key={finding.id || finding.restriction}
                        icon="🛑"
                        title={finding.display_name || finding.restriction || 'Dietary Conflict'}
                        statusLabel="Confirmed Conflict"
                        severity="critical"
                        affectedItem={finding.display_name || finding.restriction}
                        affectedItemLabel="Restricted Allergen"
                        explanation={finding.explanation}
                        evidence={finding.evidence || finding.supporting_text}
                        evidenceLabel="Packaging Allergen Evidence"
                        targetSectionId="sec-3-title"
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Marketing vs Label Contradictions */}
              {contradictions.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title critical">
                      ⚡ Marketing / AI Contradictions ({contradictions.length})
                    </h4>
                    <span className="section-help-text">Click card to jump to Contradiction Detection</span>
                  </div>
                  <div className="sheet-items-list">
                    {contradictions.map((c) => {
                      const compareEvidence: AlertEvidenceItem[] = [
                        {
                          label: 'Promotional Packaging Claim',
                          text: c.claim_text || c.claim_label,
                        },
                        {
                          label: 'Explicit Physical Label Fact',
                          text: c.supporting_text,
                        },
                      ];

                      return (
                        <AlertCard
                          key={c.id}
                          icon="⚡"
                          title={c.claim_label || 'Packaging Claim Contradiction'}
                          statusLabel="Unresolved Contradiction"
                          severity="critical"
                          affectedItem={c.claim_label}
                          affectedItemLabel="Contradicted Claim"
                          explanation={c.explanation}
                          evidence={compareEvidence}
                          targetSectionId="sec-7-title"
                          onNavigate={handleNavigate}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Manual Confirmation Items */}
              {manualConfirmations.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title warning">
                      ⚠️ Verification Required ({manualConfirmations.length})
                    </h4>
                    <p className="sheet-section-desc">
                      Label details are partially obscured or ambiguous. Check physical product to resolve:
                    </p>
                  </div>
                  <div className="sheet-items-list">
                    {manualConfirmations.map((f: CompatibilityFinding) => {
                      const resKey = f.restriction || f.id || 'unnamed_item';
                      const resTitle = f.display_name || f.restriction || 'Restricted Item';

                      const actionControls = (
                        <div className="sheet-action-buttons">
                          <button
                            type="button"
                            className="btn btn-sm btn-verify-contain"
                            onClick={() => onConfirmConflict(resKey)}
                            title="Confirm this product contains the restricted allergen"
                          >
                            ⚠️ I Checked: It CONTAINS {resTitle}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-verify-free"
                            onClick={() => onConfirmSafe(resKey)}
                            title="Confirm this product is free from the restricted allergen"
                          >
                            ✓ I Checked: It is FREE from {resTitle}
                          </button>
                        </div>
                      );

                      return (
                        <AlertCard
                          key={resKey}
                          icon="⚠️"
                          title={resTitle}
                          statusLabel="Verification Required"
                          severity="warning"
                          affectedItem={resTitle}
                          affectedItemLabel="Unverified Ingredient/Allergen"
                          explanation={f.explanation}
                          evidence={f.evidence || f.supporting_text}
                          evidenceLabel="Detected Text Snippet"
                          actions={actionControls}
                          targetSectionId="sec-3-title"
                          onNavigate={handleNavigate}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Precautionary Cross-Contact Statements */}
              {precautionaryNotices.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title info">
                      ℹ️ Precautionary Statements ({precautionaryNotices.length})
                    </h4>
                    <span className="section-help-text">Click card to jump to Allergen Findings</span>
                  </div>
                  <div className="sheet-items-list">
                    {precautionaryNotices.map((f) => (
                      <AlertCard
                        key={f.id || f.restriction}
                        icon="ℹ️"
                        title={f.display_name || f.restriction || 'Precautionary Cross-Contact'}
                        statusLabel="Precautionary Notice"
                        severity="warning"
                        affectedItem={f.display_name || f.restriction}
                        affectedItemLabel="Potential Cross-Contact"
                        explanation={f.explanation}
                        evidence={f.evidence || f.supporting_text}
                        evidenceLabel="Facility Advisory Statement"
                        targetSectionId="sec-3-title"
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Image Quality Warnings */}
              {qualityWarnings.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title warning">
                      📷 Photo Readability Notices ({qualityWarnings.length})
                    </h4>
                    <span className="section-help-text">Click card to jump to OCR Readability metrics</span>
                  </div>
                  <div className="sheet-items-list">
                    {qualityWarnings.map((warning, idx) => (
                      <AlertCard
                        key={idx}
                        icon="📷"
                        title="Packaging Clarity & OCR Notice"
                        statusLabel="Photo Readability Notice"
                        severity="warning"
                        affectedItem="Packaging Surface / Image Focus"
                        affectedItemLabel="Condition"
                        explanation={warning}
                        actions={
                          <div className="sheet-action-buttons">
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setIsOpen(false);
                                onRetake();
                              }}
                            >
                              📸 Retake Clearer Photo
                            </button>
                          </div>
                        }
                        targetSectionId="sec-2-title"
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Ambiguous Ingredients (if present) */}
              {ambiguousIngredients.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-section-title-wrap">
                    <h4 className="sheet-section-title info">
                      🔍 Ambiguous Ingredients ({ambiguousIngredients.length})
                    </h4>
                    <span className="section-help-text">Click card to jump to Ambiguous Ingredient details</span>
                  </div>
                  <div className="sheet-items-list">
                    {ambiguousIngredients.map((amb, idx) => (
                      <AlertCard
                        key={idx}
                        icon="🔍"
                        title={amb.source_text || amb.ingredient_name}
                        statusLabel="Verification Required"
                        severity="warning"
                        affectedItem={amb.category}
                        affectedItemLabel="Classification"
                        explanation={amb.explanation}
                        evidence={amb.source_text}
                        evidenceLabel="Detected Ingredient Term"
                        targetSectionId="sec-8-title"
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="alert-sheet-footer">
              <span className="footer-disclaimer">
                UnPack adheres to verified physical packaging evidence over generative assumptions.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
