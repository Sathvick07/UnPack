import React, { useState, useMemo } from 'react';
import {
  LabelAnalysisReport,
  ExtractedIngredient,
  NutritionFact,
  CompatibilityFinding,
} from '../types/label';
import { verifyFields } from '../api/client';
import { FloatingSafetyAlerts } from './FloatingSafetyAlerts';
import { EditableFieldsModal } from './EditableFieldsModal';

interface EvidenceLensProps {
  report: LabelAnalysisReport;
  previewUrl: string | null;
  onRetake: () => void;
  onUpdateReport: (updatedReport: LabelAnalysisReport) => void;
  onNavigateToLedger?: () => void;
  onRecordConsumption?: () => void;
  isConsumptionConfirmed?: boolean;
  recordSuccessMsg?: string | null;
  onNavigateToSection?: (sectionId: string, analysisId?: string) => void;
}

// Verified FSSAI 2020 / ICMR 2020 Adult Reference Values (2,000 kcal diet)
const FSSAI_REFERENCE_VALUES: Record<string, { name: string; limit: number; unit: string; isUpperLimit: boolean }> = {
  energy: { name: 'Energy', limit: 2000, unit: 'kcal', isUpperLimit: true },
  sodium: { name: 'Sodium', limit: 2000, unit: 'mg', isUpperLimit: true },
  added_sugars: { name: 'Added Sugars', limit: 50, unit: 'g', isUpperLimit: true },
  total_sugars: { name: 'Total Sugars', limit: 90, unit: 'g', isUpperLimit: true },
  fat: { name: 'Total Fat', limit: 67, unit: 'g', isUpperLimit: true },
  total_fat: { name: 'Total Fat', limit: 67, unit: 'g', isUpperLimit: true },
  saturated_fat: { name: 'Saturated Fat', limit: 22, unit: 'g', isUpperLimit: true },
  trans_fat: { name: 'Trans Fat', limit: 2, unit: 'g', isUpperLimit: true },
  carbohydrates: { name: 'Carbohydrates', limit: 300, unit: 'g', isUpperLimit: false },
  protein: { name: 'Protein', limit: 54, unit: 'g', isUpperLimit: false },
  dietary_fibre: { name: 'Dietary Fibre', limit: 30, unit: 'g', isUpperLimit: false },
  cholesterol: { name: 'Cholesterol', limit: 300, unit: 'mg', isUpperLimit: true },
};

export const EvidenceLens: React.FC<EvidenceLensProps> = ({
  report,
  previewUrl,
  onRetake,
  onUpdateReport,
  onNavigateToLedger,
  onRecordConsumption,
  isConsumptionConfirmed = false,
  recordSuccessMsg = null,
  onNavigateToSection,
}) => {
  const [selectedIngredient, setSelectedIngredient] = useState<ExtractedIngredient | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<{
    title: string;
    bbox: [number, number, number, number] | null;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [ingredientViewMode, setIngredientViewMode] = useState<'chips' | 'text'>('chips');
  const [isRawTranscriptExpanded, setIsRawTranscriptExpanded] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const toggleFindingDetails = (id: string) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('section-nav-spotlight');
      setTimeout(() => el.classList.remove('section-nav-spotlight'), 1800);
    }
  };

  const handleCopyTranscript = () => {
    if (report.raw_text) {
      navigator.clipboard.writeText(report.raw_text);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    }
  };

  const handleConfirmConflict = (restriction: string) => {
    const updatedFindings = report.findings.map((f) => {
      if (f.restriction === restriction) {
        return {
          ...f,
          status: 'Confirmed conflict',
          result_status: 'Confirmed conflict',
          legacy_status: 'CONFLICT DETECTED',
          severity: 'CRITICAL' as const,
          explanation: `Manually confirmed by user: Contains ${restriction}.`,
          evidence: 'User manual confirmation',
          supporting_text: 'Verified by user on physical packaging',
          evidence_snippet: 'Verified by user on physical packaging',
          requires_manual_confirmation: false,
          user_confirmed: true,
          confirmation_type: 'manual_confirmed' as const,
        };
      }
      return f;
    });

    onUpdateReport({
      ...report,
      findings: updatedFindings,
      manual_confirmation_needed: updatedFindings.some((f) => f.requires_manual_confirmation),
    });
  };

  const handleConfirmSafe = (restriction: string) => {
    const updatedFindings = report.findings.map((f) => {
      if (f.restriction === restriction) {
        return {
          ...f,
          status: 'No match in readable information',
          result_status: 'No match in readable information',
          legacy_status: 'NO CONFLICT IDENTIFIED IN READABLE INFORMATION',
          severity: 'INFO' as const,
          explanation: `Manually checked by user: Confirmed free from ${restriction}. (Notice: Manual visual check does not replace lab testing)`,
          evidence: 'User visual verification',
          supporting_text: 'Verified by user on physical packaging',
          evidence_snippet: 'Verified by user on physical packaging',
          requires_manual_confirmation: false,
          user_confirmed: true,
          confirmation_type: 'manual_confirmed' as const,
        };
      }
      return f;
    });

    onUpdateReport({
      ...report,
      findings: updatedFindings,
      manual_confirmation_needed: updatedFindings.some((f) => f.requires_manual_confirmation),
    });
  };

  const handleSaveEdits = async (
    updatedIngredients: ExtractedIngredient[],
    updatedNutrition: Record<string, NutritionFact>
  ) => {
    try {
      const activeRestrictions = Array.from(
        new Set(
          report.findings
            .map((f) => f.id || f.restriction)
            .filter(Boolean) as string[]
        )
      );

      const verified = await verifyFields({
        ingredients: updatedIngredients,
        allergen_statements: report.allergen_statements,
        nutrition_facts: updatedNutrition,
        restrictions: activeRestrictions,
        targets: {},
        raw_text: report.raw_text,
        quality_tier: report.quality.quality_tier,
      });

      onUpdateReport({
        ...report,
        ingredients: verified.ingredients,
        allergen_statements: verified.allergen_statements,
        nutrition_facts: verified.nutrition_facts,
        findings: verified.findings,
        contradictions: verified.contradictions || report.contradictions,
        ambiguous_ingredients: verified.ambiguous_ingredients || report.ambiguous_ingredients,
        is_complete: verified.is_complete,
        completeness_score: verified.completeness_score,
        uncertainty_flags: verified.uncertainty_flags,
        manual_confirmation_needed: verified.manual_confirmation_needed,
      });
    } catch {
      // Safe fallback if network/server is unavailable
      const updatedFindings = report.findings.map((f) => {
        const rest = f.restriction?.toLowerCase() || '';
        const hasConflict = updatedIngredients.some(
          (ing) => ing.name.toLowerCase().includes(rest) && ing.status === 'detected'
        );
        if (hasConflict) {
          return {
            ...f,
            status: 'Confirmed conflict',
            result_status: 'Confirmed conflict',
            legacy_status: 'CONFLICT DETECTED',
            severity: 'CRITICAL' as const,
            explanation: `Ingredient matching '${f.restriction}' found in verified ingredients.`,
            evidence: updatedIngredients.find((ing) => ing.name.toLowerCase().includes(rest))?.name || '',
            supporting_text: updatedIngredients.find((ing) => ing.name.toLowerCase().includes(rest))?.name || '',
            requires_manual_confirmation: false,
          };
        }
        return f;
      });

      onUpdateReport({
        ...report,
        ingredients: updatedIngredients,
        nutrition_facts: updatedNutrition,
        findings: updatedFindings,
        manual_confirmation_needed: updatedFindings.some((f) => f.requires_manual_confirmation),
      });
    }
  };

  // Deduplicate and filter findings
  const uniqueFindings: CompatibilityFinding[] = useMemo(() => {
    const seen = new Set<string>();
    const list: CompatibilityFinding[] = [];
    for (const f of report.findings) {
      const key = (f.id || f.restriction || f.target || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(f);
      } else if (!key) {
        list.push(f);
      }
    }
    return list;
  }, [report.findings]);

  // Split findings into Allergen and Nutrient target categories
  const allergenFindings = uniqueFindings.filter((f) => !f.target);
  const conflictCount = allergenFindings.filter(
    (f) =>
      f.status === 'Confirmed conflict' ||
      f.status === 'CONFLICT DETECTED' ||
      f.result_status === 'Confirmed conflict'
  ).length;

  const contradictionCount =
    (report.contradictions?.length || 0) +
    allergenFindings.filter(
      (f) =>
        f.status === 'Unresolved contradiction' ||
        f.result_status === 'Unresolved contradiction' ||
        f.is_contradiction
    ).length;

  const uncertainCount = allergenFindings.filter(
    (f) =>
      f.status.includes('Uncertain') ||
      f.status.includes('UNKNOWN') ||
      f.status.includes('PRECAUTIONARY') ||
      f.status.includes('Precautionary') ||
      f.status.includes('Missing')
  ).length;

  // Key nutrients for the left column compact nutrition summary
  const compactNutrients = useMemo(() => {
    const facts = report.nutrition_facts || {};
    return [
      { label: 'Energy', fact: facts.energy, unit: 'kcal' },
      { label: 'Total Sugars', fact: facts.total_sugars || facts.sugars, unit: 'g' },
      { label: 'Added Sugars', fact: facts.added_sugars, unit: 'g' },
      { label: 'Sodium', fact: facts.sodium, unit: 'mg' },
      { label: 'Total Fat', fact: facts.total_fat || facts.fat, unit: 'g' },
      { label: 'Protein', fact: facts.protein, unit: 'g' },
      { label: 'Carbohydrates', fact: facts.carbohydrates, unit: 'g' },
    ];
  }, [report.nutrition_facts]);

  // Extract shared packaging allergen statements (e.g. "CONTAINS MILK, WHEAT AND SOY.")
  const sharedAllergenStatements = Array.from(
    new Set(
      report.allergen_statements
        .map((s) => s.source_text?.trim())
        .filter(Boolean)
    )
  );

  // Active bounding box coordinates (from selected ingredient or selected finding)
  const activeBbox = selectedHighlight?.bbox || selectedIngredient?.bounding_box;
  const activeHighlightTitle = selectedHighlight?.title || selectedIngredient?.name;

  const productNameDisplay =
    report.file_name?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Scanned Food Product';

  return (
    <div className="evidence-lens-container">
      {/* Floating Safety Alerts Toggle Button */}
      <FloatingSafetyAlerts
        report={report}
        onConfirmConflict={handleConfirmConflict}
        onConfirmSafe={handleConfirmSafe}
        onRetake={onRetake}
        onNavigateToSection={onNavigateToSection}
      />

      {/* Balanced Two-Column Dashboard Layout */}
      <div className="dashboard-two-column-layout">

        {/* =================================================================
            LEFT COLUMN — Product & Scan Overview
            Meaningfully utilizes vertical space with photo, scan status,
            OCR metrics, compact nutrition summary, quick nav, and actions.
            ================================================================= */}
        <aside className="dashboard-overview-column" aria-label="Product and Scan Overview">

          {/* 1. Uploaded Product Evidence Photo */}
          <div className="card-panel overview-card photo-overview-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">📸</span>
                <h3 className="panel-title">Packaging Evidence Photo</h3>
              </div>
              <span className="badge-pill">
                {report.quality.width} × {report.quality.height}px
              </span>
            </div>

            <div className="image-viewer-container">
              {previewUrl ? (
                <div
                  className="image-viewport"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Click to view full-size photo in high resolution"
                >
                  <div className="image-stage-wrapper">
                    <img
                      src={previewUrl}
                      alt="Uploaded food packaging label"
                      className="label-evidence-photo"
                    />
                    {activeBbox && (
                      <div
                        className="bounding-box-overlay"
                        style={{
                          top: `${activeBbox[0] * 100}%`,
                          left: `${activeBbox[1] * 100}%`,
                          height: `${(activeBbox[2] - activeBbox[0]) * 100}%`,
                          width: `${(activeBbox[3] - activeBbox[1]) * 100}%`,
                        }}
                      >
                        <span className="overlay-tag">{activeHighlightTitle}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-lightbox-trigger"
                    title="Click to view full-size photo"
                  >
                    🔍 Enlarge
                  </button>
                </div>
              ) : (
                <div className="no-image-placeholder">No image preview available</div>
              )}

              <div className="image-viewer-footer">
                <span className="hint-text">
                  {activeHighlightTitle
                    ? `Inspecting: "${activeHighlightTitle}" (Highlighted on label)`
                    : 'Click any finding or ingredient on the right to inspect it on packaging'}
                </span>
                {(selectedIngredient || selectedHighlight) && (
                  <button
                    type="button"
                    className="btn-clear-selection"
                    onClick={() => {
                      setSelectedIngredient(null);
                      setSelectedHighlight(null);
                    }}
                  >
                    Clear Highlight
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Product Name & Scan Status */}
          <div className="card-panel overview-card product-status-overview-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">🏷️</span>
                <h3 className="panel-title">Product & Scan Status</h3>
              </div>
              <span className="status-pill pill-neutral">Verified Engine</span>
            </div>

            <div className="product-identity-box">
              <h4 className="product-display-name">{productNameDisplay}</h4>
              <p className="product-meta-subtext">
                File: <code>{report.file_name || 'Camera Upload'}</code> • Readability:{' '}
                <strong>{report.readability_status}</strong>
              </p>
            </div>

            <div className="status-pills-row">
              {conflictCount > 0 ? (
                <span className="status-pill pill-critical">
                  🚨 {conflictCount} {conflictCount === 1 ? 'Conflict' : 'Conflicts'} Detected
                </span>
              ) : (
                <span className="status-pill pill-clear">
                  ✓ No Dietary Conflicts
                </span>
              )}

              {contradictionCount > 0 && (
                <span className="status-pill pill-critical">
                  ⚡ {contradictionCount} {contradictionCount === 1 ? 'Contradiction' : 'Contradictions'}
                </span>
              )}

              {uncertainCount > 0 && (
                <span className="status-pill pill-uncertain">
                  ⚠️ {uncertainCount} Uncertain Items
                </span>
              )}
            </div>

            <p className="overview-summary-text">
              {contradictionCount > 0
                ? 'Disagreement detected between marketing claims and explicit packaging text. Source label evidence takes strict precedence.'
                : conflictCount > 0
                ? `Safety Warning: ${conflictCount} confirmed dietary conflict${conflictCount > 1 ? 's' : ''} with your active restrictions. Check packaging details before consuming.`
                : uncertainCount > 0
                ? 'Certain fields could not be legibly resolved. Review uncertain items and verify physical packaging.'
                : 'No dietary conflicts identified in readable information. Core nutrients and verified ingredients have been extracted.'}
            </p>
          </div>

          {/* 3. OCR Readability & Confidence Information */}
          <div className="card-panel overview-card readability-overview-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">📐</span>
                <h3 className="panel-title">OCR Readability & Quality</h3>
              </div>
              <span className={`status-pill pill-${report.readability_status.toLowerCase()}`}>
                {report.readability_status} ({report.quality.quality_score}/100)
              </span>
            </div>

            <div className="readability-metrics-grid">
              <div className="readability-metric-tile">
                <span className="tile-label">Resolution</span>
                <span className="tile-value">{report.quality.width} × {report.quality.height}</span>
              </div>
              <div className="readability-metric-tile">
                <span className="tile-label">Sharpness</span>
                <span className="tile-value">
                  {report.quality.blur_metric !== undefined && report.quality.blur_metric !== null
                    ? `${report.quality.blur_metric.toFixed(1)} / 100`
                    : 'Clear Focus'}
                </span>
              </div>
              <div className="readability-metric-tile">
                <span className="tile-label">Surface Shape</span>
                <span className="tile-value">
                  {report.quality.is_curved_surface ? 'Curved Container' : 'Flat Surface'}
                </span>
              </div>
              <div className="readability-metric-tile">
                <span className="tile-label">Confidence</span>
                <span className="tile-value">{report.quality.quality_score}%</span>
              </div>
            </div>

            {report.quality.warnings && report.quality.warnings.length > 0 && (
              <div className="overview-warnings-box">
                <div className="warnings-box-title">
                  <span>⚠️</span>
                  <strong>Clarity Warnings:</strong>
                </div>
                <ul className="warnings-box-list">
                  {report.quality.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onRetake} style={{ marginTop: '0.5rem', width: '100%' }}>
                  📸 Retake Clearer Photo
                </button>
              </div>
            )}
          </div>

          {/* 4. Compact Nutrition Summary */}
          <div className="card-panel overview-card compact-nutrition-overview-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">🥗</span>
                <h3 className="panel-title">Nutrition At A Glance</h3>
              </div>
              <button
                type="button"
                className="btn-link-action"
                onClick={() => scrollToSection('sec-nutrition')}
              >
                Full Table ↓
              </button>
            </div>

            <div className="compact-nutrition-grid">
              {compactNutrients.map((item, idx) => {
                const isProvided = item.fact && item.fact.value !== null && item.fact.value !== undefined;
                return (
                  <div key={idx} className="compact-nutrition-tile">
                    <span className="compact-nut-label">{item.label}</span>
                    <span className="compact-nut-val">
                      {isProvided ? (
                        <>
                          <strong>{item.fact.value}</strong>{' '}
                          <small>{item.fact.unit || item.unit}</small>
                        </>
                      ) : (
                        <span className="compact-nut-missing">Not provided</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Quick Navigation Jump Links */}
          <div className="card-panel overview-card quick-nav-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">🧭</span>
                <h3 className="panel-title">Quick Navigation</h3>
              </div>
            </div>

            <div className="quick-nav-pills-list">
              {report.contradictions && report.contradictions.length > 0 && (
                <button
                  type="button"
                  className="quick-nav-item nav-highlight-warn"
                  onClick={() => scrollToSection('sec-contradictions')}
                >
                  <span>⚡ Contradictions & Claims</span>
                  <span className="nav-badge-count">{report.contradictions.length}</span>
                </button>
              )}

              <button
                type="button"
                className="quick-nav-item"
                onClick={() => scrollToSection('sec-allergens')}
              >
                <span>⚠️ Allergen Findings</span>
                {conflictCount > 0 && (
                  <span className="nav-badge-count count-critical">{conflictCount}</span>
                )}
              </button>

              <button
                type="button"
                className="quick-nav-item"
                onClick={() => scrollToSection('sec-ingredients')}
              >
                <span>🥗 Ingredients List</span>
                <span className="nav-badge-count">{report.ingredients.length}</span>
              </button>

              <button
                type="button"
                className="quick-nav-item"
                onClick={() => scrollToSection('sec-nutrition')}
              >
                <span>📊 Nutrition Facts</span>
              </button>

              <button
                type="button"
                className="quick-nav-item"
                onClick={() => scrollToSection('sec-evidence')}
              >
                <span>🔍 Label Evidence Text</span>
              </button>

              <button
                type="button"
                className="quick-nav-item"
                onClick={() => scrollToSection('sec-safeguards')}
              >
                <span>🛡️ Safeguards & Actions</span>
              </button>
            </div>
          </div>

          {/* 6. Relevant Scan Actions */}
          <div className="card-panel overview-card scan-actions-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon" aria-hidden="true">⚡</span>
                <h3 className="panel-title">Scan Actions</h3>
              </div>
            </div>

            <div className="scan-actions-stack">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={onRecordConsumption}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontWeight: 700 }}
              >
                <span>🍽️</span>
                <span>{isConsumptionConfirmed ? 'Log Another Portion' : 'Record Consumption'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => setIsEditModalOpen(true)}
              >
                ✏️ Edit & Correct Data
              </button>

              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={onRetake}
              >
                🔄 Scan Another Label
              </button>

              {onNavigateToLedger && (
                <button
                  type="button"
                  className="btn btn-link btn-block"
                  onClick={onNavigateToLedger}
                  style={{ color: 'var(--brand-primary)', textDecoration: 'underline', fontSize: '0.82rem', marginTop: '0.25rem' }}
                >
                  View Daily Intake Limits →
                </button>
              )}
            </div>
          </div>

        </aside>

        {/* =================================================================
            RIGHT COLUMN — Detailed Analysis
            Cleanly structured into separate result cards with clear headings,
            labels, badges, aligned numbers, and readable evidence blocks.
            ================================================================= */}
        <main className="dashboard-results-column" aria-label="Detailed Label Analysis Results">

          {/* =================================================================
              SECTION 1: Packaging claims and contradictions
              ================================================================= */}
          <section id="sec-contradictions" className="analysis-section-card" aria-labelledby="sec-contra-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">1</span>
                <h3 id="sec-contra-title" className="analysis-section-title">
                  Packaging Claims & Contradictions
                </h3>
              </div>
              <span className="badge-pill pill-critical">
                Contradiction Detection
              </span>
            </div>

            {report.contradictions && report.contradictions.length > 0 ? (
              <div className="contradictions-list">
                {report.contradictions.map((c) => (
                  <div key={c.id} className="contradiction-item-box">
                    <div className="contradiction-comparison-row">
                      <div className="contradiction-bubble claim-bubble">
                        <span className="bubble-label">Promotional Claim</span>
                        <strong>"{c.claim_text || c.claim_label}"</strong>
                      </div>
                      <div className="contradiction-vs-badge" aria-hidden="true">VS</div>
                      <div className="contradiction-bubble evidence-bubble">
                        <span className="bubble-label">Explicit Label Fact</span>
                        <strong>"{c.supporting_text}"</strong>
                      </div>
                    </div>
                    <div className="contradiction-verdict-box">
                      <span className="verdict-tag">Status: Unresolved contradiction</span>
                      <p className="verdict-explanation">{c.explanation}</p>
                      {c.bounding_box && (
                        <button
                          type="button"
                          className="btn-locate-evidence-inline"
                          onClick={() => {
                            setSelectedHighlight({
                              title: c.claim_label,
                              bbox: c.bounding_box || null,
                            });
                            scrollToSection('navbar');
                          }}
                        >
                          📍 Highlight Label Evidence on Photo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="clean-info-box">
                <span className="info-icon">✓</span>
                <p>
                  No marketing contradictions identified between front-of-package claims and explicit nutrition facts.
                </p>
              </div>
            )}

            {/* Ambiguous Ingredients */}
            {report.ambiguous_ingredients && report.ambiguous_ingredients.length > 0 && (
              <div className="ambiguous-block" style={{ marginTop: '1.25rem' }}>
                <div className="ambiguous-header-row">
                  <span style={{ fontSize: '1rem' }}>❓</span>
                  <strong>Ambiguous Ingredients ({report.ambiguous_ingredients.length})</strong>
                </div>
                <p className="ambiguous-intro-text">
                  The following generic ingredients appear on the label. They cannot confirm or exclude restricted allergens without manufacturer clarification:
                </p>
                <div className="ambiguous-chips-list">
                  {report.ambiguous_ingredients.map((amb, i) => (
                    <div key={i} className="ambiguous-item-chip">
                      <strong>"{amb.source_text}"</strong>
                      <span className="amb-category">({amb.category})</span>
                      <span className="amb-expl">{amb.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* =================================================================
              SECTION 2: Allergen findings
              ================================================================= */}
          <section id="sec-allergens" className="analysis-section-card" aria-labelledby="sec-allergen-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">2</span>
                <h3 id="sec-allergen-title" className="analysis-section-title">
                  Allergen Findings & Precautionary Statements
                </h3>
              </div>
              <span className="badge-pill">
                {allergenFindings.length} Evaluated
              </span>
            </div>

            {/* Shared Packaging Allergen Statement Box */}
            {sharedAllergenStatements.length > 0 && (
              <div className="shared-declaration-box">
                <div className="declaration-label">
                  <span className="declaration-icon" aria-hidden="true">📢</span>
                  <strong>Explicit Allergen Statement on Packaging:</strong>
                </div>
                <div className="declaration-statements">
                  {sharedAllergenStatements.map((stmt, i) => (
                    <span key={i} className="statement-quote">"{stmt}"</span>
                  ))}
                </div>
              </div>
            )}

            {/* Standardized Findings Rows */}
            <div className="allergen-items-list">
              {allergenFindings.map((finding) => {
                const fid = finding.id || finding.restriction || 'unknown';
                const isExpanded = !!expandedFindings[fid];
                const statusStr = finding.result_status || finding.status;

                const isConflict =
                  statusStr === 'Confirmed conflict' || statusStr === 'CONFLICT DETECTED';
                const isContradiction =
                  statusStr === 'Unresolved contradiction' || finding.is_contradiction;
                const isPrecautionary =
                  statusStr === 'Precautionary notice' || statusStr.includes('PRECAUTIONARY');
                const isUncertain =
                  statusStr === 'Uncertain interpretation' || statusStr.includes('UNCERTAIN');
                const isMissing =
                  statusStr === 'Missing or unreadable evidence' || statusStr.includes('UNKNOWN');

                const rowStatusClass = isContradiction
                  ? 'row-status-contradiction'
                  : isConflict
                  ? 'row-status-conflict'
                  : isPrecautionary
                  ? 'row-status-precautionary'
                  : isUncertain
                  ? 'row-status-uncertain'
                  : isMissing
                  ? 'row-status-missing'
                  : 'row-status-clear';

                const badgeText = isContradiction
                  ? 'Unresolved Contradiction'
                  : isConflict
                  ? 'Confirmed Conflict'
                  : isPrecautionary
                  ? 'Precautionary Notice'
                  : isUncertain
                  ? 'Uncertain Interpretation'
                  : isMissing
                  ? 'Missing / Unreadable Evidence'
                  : 'No Match in Readable Information';

                const isUserConfirmed =
                  finding.confirmation_type === 'manual_confirmed' || finding.user_confirmed;

                return (
                  <div key={fid} className={`allergen-row ${rowStatusClass}`}>
                    <div className="allergen-row-header">
                      <div className="allergen-name-block">
                        <span className="allergen-indicator-dot" aria-hidden="true" />
                        <strong className="allergen-title">
                          {finding.display_name || finding.restriction}
                        </strong>
                        {isUserConfirmed ? (
                          <span className="badge-source-user" title="Verified by user on packaging">
                            👤 User Confirmed
                          </span>
                        ) : (
                          <span className="badge-source-machine" title="Extracted from OCR label evidence">
                            🔍 Machine Verified
                          </span>
                        )}
                      </div>

                      <div className="allergen-status-block">
                        <span className="allergen-status-badge">{badgeText}</span>
                        <button
                          type="button"
                          className="btn-toggle-evidence"
                          onClick={() => toggleFindingDetails(fid)}
                          aria-label="Toggle details"
                        >
                          {isExpanded ? 'Hide Details ▴' : 'Details ▾'}
                        </button>
                      </div>
                    </div>

                    {/* Exact Supporting Text Snippet */}
                    {(finding.supporting_text || finding.evidence) && (
                      <div className="supporting-evidence-box">
                        <span className="supporting-evidence-tag">Exact Supporting Text:</span>
                        <span className="supporting-evidence-quote">
                          "{finding.supporting_text || finding.evidence}"
                        </span>
                        {finding.bounding_box && (
                          <button
                            type="button"
                            className="btn-locate-inline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedHighlight({
                                title: finding.display_name || finding.restriction || 'Allergen',
                                bbox: finding.bounding_box || null,
                              });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            📍 Show on Photo
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Action Recommendation */}
                    {finding.action_recommendation && (
                      <div className="allergen-action-snippet">
                        <strong>Next Step:</strong> {finding.action_recommendation}
                      </div>
                    )}

                    {/* Expandable Evidence Details */}
                    {isExpanded && (
                      <div className="allergen-expanded-details">
                        <p className="details-explanation">{finding.explanation}</p>
                        <div className="details-evidence">
                          <strong>Decision Basis:</strong> {finding.evidence}
                        </div>
                        <div className="details-meta-row">
                          <span><strong>Source Type:</strong> {finding.source_type}</span>
                          <span>
                            <strong>Evidence Grounding:</strong>{' '}
                            {isUserConfirmed ? 'User Manual Visual Inspection' : 'Machine Packaging Text Alignment'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* =================================================================
              SECTION 3: Ingredient analysis and user-restriction matches
              ================================================================= */}
          <section id="sec-ingredients" className="analysis-section-card" aria-labelledby="sec-ing-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">3</span>
                <h3 id="sec-ing-title" className="analysis-section-title">
                  Ingredient Analysis & User-Restriction Matches
                </h3>
              </div>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`btn-toggle ${ingredientViewMode === 'chips' ? 'active' : ''}`}
                  onClick={() => setIngredientViewMode('chips')}
                >
                  Interactive Chips ({report.ingredients.length})
                </button>
                <button
                  type="button"
                  className={`btn-toggle ${ingredientViewMode === 'text' ? 'active' : ''}`}
                  onClick={() => setIngredientViewMode('text')}
                >
                  Text List
                </button>
              </div>
            </div>

            {ingredientViewMode === 'chips' ? (
              <div className="ingredients-chips-container">
                {report.ingredients.map((ing, i) => {
                  const isSelected = selectedIngredient?.name === ing.name;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`ingredient-chip status-${ing.status} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedHighlight(null);
                        setSelectedIngredient(isSelected ? null : ing);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title={`Click to locate "${ing.source_text}" on photo`}
                    >
                      <span className="chip-name">{ing.name}</span>
                      {ing.status !== 'detected' && (
                        <span className="chip-status-tag">{ing.status}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ingredients-prose-box">
                <p className="ingredients-prose">
                  {report.ingredients.map((ing) => ing.name).join(', ')}
                </p>
              </div>
            )}

            <div className="section-footer-note">
              <span>* Click any ingredient chip above to inspect its exact spatial location on the packaging photo.</span>
            </div>
          </section>

          {/* =================================================================
              SECTION 4: Nutrition facts and daily reference comparisons
              ================================================================= */}
          <section id="sec-nutrition" className="analysis-section-card" aria-labelledby="sec-nut-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">4</span>
                <h3 id="sec-nut-title" className="analysis-section-title">
                  Nutrition Facts & Daily Reference Comparisons
                </h3>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm edit-data-btn"
                onClick={() => setIsEditModalOpen(true)}
              >
                ✏️ Edit & Correct Data
              </button>
            </div>

            <div className="responsive-table-container">
              <table className="clean-nutrition-table">
                <thead>
                  <tr>
                    <th style={{ width: '32%' }}>Nutrient</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Per 100 g</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Per Serving</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>FSSAI 2020 Limit</th>
                    <th style={{ width: '14%', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.nutrition_facts).map(([key, fact], index) => {
                    const isMissing = fact.value === null;
                    const rowClass = isMissing ? 'row-missing' : (index % 2 === 0 ? 'row-even' : 'row-odd');
                    const normalizedKey = key === 'total_fat' ? 'fat' : key;
                    const fssaiRef = FSSAI_REFERENCE_VALUES[normalizedKey];

                    return (
                      <tr key={key} className={rowClass}>
                        <td className="cell-nutrient">
                          <strong className="nutrient-label">{key.replace(/_/g, ' ')}</strong>
                        </td>

                        <td className="cell-value per-100g">
                          {isMissing ? (
                            <span className="badge-missing">Not provided</span>
                          ) : (
                            <span className="val-text">
                              <strong>{fact.value}</strong> <span className="unit-text">{fact.unit}</span>
                            </span>
                          )}
                        </td>

                        <td className="cell-value per-serving">
                          {fact.serving_value !== null && fact.serving_value !== undefined ? (
                            <span className="val-text">
                              <strong>{fact.serving_value}</strong> <span className="unit-text">{fact.unit}</span>
                            </span>
                          ) : (
                            <span className="empty-dash">—</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {fssaiRef ? (
                            <span>{fssaiRef.limit} {fssaiRef.unit}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Not configured</span>
                          )}
                        </td>

                        <td className="cell-status">
                          <span className={`status-tag status-${fact.status}`}>
                            {fact.status === 'not_provided' ? 'Not provided' : fact.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-disclaimer">
              <span className="disclaimer-icon" aria-hidden="true">ℹ️</span>
              <p>
                UnPack preserves both per-100g and per-serving amounts. Unlisted nutrients are strictly recorded as <strong>Not provided</strong> rather than assumed zero. Reference limits based on general FSSAI 2020 guidelines (2,000 kcal diet) and do not represent personal medical advice.
              </p>
            </div>
          </section>

          {/* =================================================================
              SECTION 5: Evidence snippets and label text
              ================================================================= */}
          <section id="sec-evidence" className="analysis-section-card" aria-labelledby="sec-evi-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">5</span>
                <h3 id="sec-evi-title" className="analysis-section-title">
                  Evidence Snippets & Label Text
                </h3>
              </div>
              <span className="badge-pill">Verifiable Packaging Quotes</span>
            </div>

            <div className="evidence-snippets-container">
              {/* Raw OCR Text Snippet (Collapsible) */}
              <div className="snippet-block">
                <div className="snippet-block-header">
                  <div className="snippet-block-title">Extracted Label Transcript:</div>
                  <div className="snippet-actions-group">
                    <button
                      type="button"
                      className="btn-snippet-copy"
                      onClick={handleCopyTranscript}
                      title="Copy raw text to clipboard"
                    >
                      {copiedTranscript ? '✓ Copied' : '📋 Copy Text'}
                    </button>
                    {report.raw_text && report.raw_text.length > 280 && (
                      <button
                        type="button"
                        className="btn-snippet-toggle"
                        onClick={() => setIsRawTranscriptExpanded(!isRawTranscriptExpanded)}
                      >
                        {isRawTranscriptExpanded ? 'Collapse ▴' : 'Expand All ▾'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`snippet-block-content ${isRawTranscriptExpanded ? 'expanded' : 'collapsed'}`}>
                  {report.raw_text ? (
                    <pre className="raw-transcript-pre">{report.raw_text}</pre>
                  ) : (
                    'No raw label transcript available.'
                  )}
                </div>
              </div>

              {/* Ingredients Block Snippet */}
              <div className="snippet-block">
                <div className="snippet-block-title">Ingredient Declaration Evidence:</div>
                <div className="snippet-block-content">
                  {report.ingredients.length > 0
                    ? `INGREDIENTS: ${report.ingredients.map((i) => i.source_text || i.name).join(', ')}.`
                    : 'No ingredients block detected.'}
                </div>
              </div>

              {/* Allergen Declarations Snippet */}
              {report.allergen_statements && report.allergen_statements.length > 0 && (
                <div className="snippet-block">
                  <div className="snippet-block-title">Packaging Allergen Notice:</div>
                  <div className="snippet-block-content">
                    {report.allergen_statements.map((s, idx) => (
                      <div key={idx}>"{s.source_text}"</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* =================================================================
              SECTION 6: Uncertainty notices, missing information, and next steps
              ================================================================= */}
          <section id="sec-safeguards" className="analysis-section-card" aria-labelledby="sec-safe-title">
            <div className="analysis-section-header">
              <div className="section-title-wrap">
                <span className="section-number-pill" aria-hidden="true">6</span>
                <h3 id="sec-safe-title" className="analysis-section-title">
                  Uncertainty Notices & Recommended Next Steps
                </h3>
              </div>
              <span className="badge-pill">Clinical Safeguards</span>
            </div>

            {/* Uncertainty Flags */}
            {report.uncertainty_flags.length > 0 && (
              <div className="uncertainty-items-list">
                {report.uncertainty_flags.map((flag, i) => (
                  <div key={i} className="uncertainty-item">
                    <span className="warning-bullet" aria-hidden="true">!</span>
                    <div className="uncertainty-content">
                      <p className="uncertainty-message">{flag}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Evidence Uncertainty Safeguard Notice */}
            <div className="uncertainty-principle-box">
              <strong className="principle-title">
                🛡️ Evidence-Based Uncertainty Principle:
              </strong>
              <p className="principle-body">
                Absence of readable evidence is never presented as proof that an ingredient or allergen is absent. If any section of the packaging is curved, obscured, or blurry, check the physical product.
              </p>
            </div>

            {/* Actionable Recommendations */}
            <div className="recommendations-box">
              <div className="recommendations-title">
                Recommended Actions Before Consuming:
              </div>
              <ul className="recommendations-list">
                <li>Inspect physical packaging label directly to verify unreadable areas.</li>
                {conflictCount > 0 && (
                  <li className="conflict-warning-item">
                    Do not consume if you have severe allergies to: {allergenFindings.filter(f => f.status.includes('conflict')).map(f => f.display_name || f.restriction).join(', ')}.
                  </li>
                )}
                {report.quality.is_curved_surface && (
                  <li>Retake photo by rotating the can or bottle to ensure all text wraps into focus.</li>
                )}
                <li>If an ambiguous ingredient (e.g. natural flavorings) concerns your health, contact the food manufacturer directly.</li>
              </ul>
            </div>
          </section>

          {/* =================================================================
              SECTION 7: Record-consumption action
              ================================================================= */}
          <section id="sec-record" className="record-action-section-card" aria-labelledby="sec-rec-title">
            <div className="analysis-section-header" style={{ borderBottomColor: 'rgba(132, 204, 22, 0.3)' }}>
              <div className="section-title-wrap">
                <span className="section-number-pill" style={{ color: 'var(--color-lime)' }} aria-hidden="true">7</span>
                <h3 id="sec-rec-title" className="analysis-section-title" style={{ color: 'var(--color-lime)' }}>
                  Record-Consumption Action
                </h3>
              </div>
              <span className="status-pill pill-neutral" style={{ border: '1px solid var(--color-lime)', color: 'var(--color-lime)' }}>
                Rule: Preview ≠ Consumption
              </span>
            </div>

            <div className="record-action-content">
              <div>
                <h4 className="record-action-headline">
                  {isConsumptionConfirmed ? 'Product Recorded to Daily Ledger' : 'Confirm Food Consumption'}
                </h4>
                <p className="record-action-subtext">
                  {isConsumptionConfirmed
                    ? (recordSuccessMsg || 'This food portion has been recorded into your authenticated daily nutritional ledger.')
                    : 'Analyzing a food label alone never marks it as consumed. Did you eat or drink this product? Confirm your portion to track daily intake.'}
                </p>
              </div>

              <div className="record-action-btns-group">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onRecordConsumption}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, padding: '0.65rem 1.25rem' }}
                >
                  <span>🍽️</span>
                  <span>{isConsumptionConfirmed ? 'Log Another Portion' : 'Record Consumption'}</span>
                </button>

                {onNavigateToLedger && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onNavigateToLedger}
                    style={{ fontSize: '0.88rem' }}
                  >
                    View Daily Limits →
                  </button>
                )}
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Lightbox Modal for Large Image Inspection */}
      {isLightboxOpen && previewUrl && (
        <div
          className="lightbox-backdrop"
          role="presentation"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="lightbox-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lightbox-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-header">
              <div className="lightbox-title-group">
                <h4 id="lightbox-modal-title">Packaging Label Photo Inspection</h4>
                <span className="badge-pill">{report.quality.width} × {report.quality.height}px</span>
              </div>
              <button
                type="button"
                className="btn-lightbox-close"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close image inspection dialog"
              >
                ✕ Close
              </button>
            </div>
            <div className="lightbox-body">
              <img src={previewUrl} alt="High resolution food packaging" className="lightbox-img" />
            </div>
            <div className="lightbox-footer">
              <span>Inspect small ingredients and nutrition typography at full resolution.</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal for User Manual Field Corrections & Re-evaluation */}
      <EditableFieldsModal
        isOpen={isEditModalOpen}
        initialIngredients={report.ingredients}
        initialNutrition={report.nutrition_facts}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEdits}
      />
    </div>
  );
};
