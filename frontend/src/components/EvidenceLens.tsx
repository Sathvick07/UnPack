import React, { useState } from 'react';
import {
  LabelAnalysisReport,
  ExtractedIngredient,
  NutritionFact,
  CompatibilityFinding,
} from '../types/label';
import { verifyFields } from '../api/client';
import { QualityWarningBanner } from './QualityWarningBanner';
import { ManualConfirmationCard } from './ManualConfirmationCard';
import { EditableFieldsModal } from './EditableFieldsModal';

interface EvidenceLensProps {
  report: LabelAnalysisReport;
  previewUrl: string | null;
  onRetake: () => void;
  onUpdateReport: (updatedReport: LabelAnalysisReport) => void;
}

export const EvidenceLens: React.FC<EvidenceLensProps> = ({
  report,
  previewUrl,
  onRetake,
  onUpdateReport,
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

  const toggleFindingDetails = (id: string) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
  const uniqueFindings: CompatibilityFinding[] = React.useMemo(() => {
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

  const contradictionCount = (report.contradictions?.length || 0) +
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

  return (
    <div className="evidence-lens-container">
      {/* 1. Image Quality Warning Banner */}
      <QualityWarningBanner quality={report.quality} onRetake={onRetake} />

      {/* 2. Manual Confirmation Requests for Uncertain/Unclear Text */}
      {report.findings
        .filter((f) => f.requires_manual_confirmation)
        .map((finding, idx) => (
          <ManualConfirmationCard
            key={idx}
            finding={finding}
            onConfirmConflict={handleConfirmConflict}
            onConfirmSafe={handleConfirmSafe}
            onRetake={onRetake}
          />
        ))}

      {/* Balanced Two-Column Dashboard Layout (40% Image / 60% Results) */}
      <div className="dashboard-two-column-layout">
        {/* Left Column: Packaging Image & Physical Inspection */}
        <div className="dashboard-image-column">
          <div className="card-panel sticky-image-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon">📷</span>
                <h3 className="panel-title">Packaging Evidence</h3>
              </div>
              <span className="badge-pill">
                {report.quality.width}x{report.quality.height}px
              </span>
            </div>

            <div className="image-viewer-container">
              {previewUrl ? (
                <div className="image-viewport" onClick={() => setIsLightboxOpen(true)}>
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
                    : 'Click any extracted ingredient or finding to locate it on the packaging'}
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
        </div>

        {/* Right Column: Structured Results Dashboard */}
        <div className="dashboard-results-column">
          {/* Section 1: Scan Summary Overview */}
          <div className="card-panel summary-overview-card">
            <div className="summary-header">
              <div>
                <span className="section-label">Scan Summary (Mission 3 Grounded Engine)</span>
                <h3 className="summary-title">Label Analysis Overview</h3>
              </div>
              <div className="summary-badge-group">
                <span className={`status-pill pill-${report.readability_status.toLowerCase()}`}>
                  {report.readability_status} QUALITY ({report.quality.quality_score}/100)
                </span>
                {conflictCount > 0 && (
                  <span className="status-pill pill-critical">
                    ⚠️ {conflictCount} {conflictCount === 1 ? 'Conflict' : 'Conflicts'} Detected
                  </span>
                )}
                {contradictionCount > 0 && (
                  <span className="status-pill pill-critical">
                    ⚡ {contradictionCount} {contradictionCount === 1 ? 'Contradiction' : 'Contradictions'}
                  </span>
                )}
              </div>
            </div>

            <p className="summary-description">
              {contradictionCount > 0
                ? `Alert: Disagreement detected between AI interpretation / marketing claims and explicit packaging text. Source label evidence takes strict precedence.`
                : conflictCount > 0
                ? `Safety warning: Found ${conflictCount} confirmed dietary conflict${conflictCount > 1 ? 's' : ''} with your active restrictions. Check packaging details below before consuming.`
                : uncertainCount > 0
                ? 'Notice: Certain fields or text sections could not be legibly resolved. Review uncertain items and verify physical packaging.'
                : 'No dietary conflicts identified in readable information. Core nutrients and verified ingredients have been extracted below.'}
            </p>
          </div>

          {/* Section 2: Contradiction Detection Card (Mission 3 Core Requirement) */}
          {((report.contradictions && report.contradictions.length > 0) ||
            allergenFindings.some((f) => f.is_contradiction || f.status === 'Unresolved contradiction')) && (
            <div className="card-panel contradiction-card-panel">
              <div className="panel-header contradiction-header">
                <div className="header-title-group">
                  <span className="header-icon">⚡</span>
                  <h3 className="panel-title">Contradiction Alert: AI / Marketing vs. Source Text</h3>
                </div>
                <span className="badge-pill pill-critical">
                  Unresolved Contradiction
                </span>
              </div>

              <div className="contradiction-banner-box">
                <p>
                  <strong>Clinical Safety Rule:</strong> UnPack strictly rejects AI hallucinations and promotional packaging claims whenever they contradict the explicit ingredient declaration or nutrition table.
                </p>
              </div>

              <div className="contradictions-list">
                {report.contradictions?.map((c) => (
                  <div key={c.id} className="contradiction-item-box">
                    <div className="contradiction-comparison-row">
                      <div className="contradiction-bubble claim-bubble">
                        <span className="bubble-label">AI / Promotional Claim</span>
                        <strong>"{c.claim_text || c.claim_label}"</strong>
                      </div>
                      <div className="contradiction-vs-badge">VS</div>
                      <div className="contradiction-bubble evidence-bubble">
                        <span className="bubble-label">Explicit Label Evidence</span>
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
                          }}
                        >
                          📍 Highlight Label Evidence
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Evidence-Grounded Allergen Safety Findings */}
          <div className="card-panel allergen-safety-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon">🛡️</span>
                <h3 className="panel-title">Evidence-Grounded Allergen Comparison</h3>
              </div>
              <span className="badge-pill">
                {allergenFindings.length} Checked
              </span>
            </div>

            {/* Consolidated Shared Packaging Allergen Declaration */}
            {sharedAllergenStatements.length > 0 && (
              <div className="shared-declaration-box">
                <div className="declaration-label">
                  <span className="declaration-icon">📋</span>
                  <strong>Declared on Packaging:</strong>
                </div>
                <div className="declaration-statements">
                  {sharedAllergenStatements.map((stmt, i) => (
                    <span key={i} className="statement-quote">"{stmt}"</span>
                  ))}
                </div>
              </div>
            )}

            {/* Compact Allergen Rows adhering to the 6 Standardized Statuses */}
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
                        <span className="allergen-indicator-dot" />
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
                          {isExpanded ? 'Hide Details ▲' : 'Details ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Exact Supporting Text Snippet (Mission 3 Core Requirement) */}
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
          </div>

          {/* Section 4: Ambiguous Ingredients Callout (if any) */}
          {report.ambiguous_ingredients && report.ambiguous_ingredients.length > 0 && (
            <div className="card-panel ambiguous-card-panel">
              <div className="panel-header">
                <div className="header-title-group">
                  <span className="header-icon">❓</span>
                  <h3 className="panel-title">Ambiguous Ingredients Detected</h3>
                </div>
                <span className="badge-pill">
                  {report.ambiguous_ingredients.length} Requires Clarification
                </span>
              </div>
              <p className="ambiguous-note">
                The following generic terms appear in the ingredient list. They cannot confirm or exclude restricted hazards without manufacturer clarification:
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

          {/* Section 5: Extracted Ingredients */}
          <div className="card-panel ingredients-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon">🥗</span>
                <h3 className="panel-title">
                  Extracted Ingredients ({report.ingredients.length})
                </h3>
              </div>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`btn-toggle ${ingredientViewMode === 'chips' ? 'active' : ''}`}
                  onClick={() => setIngredientViewMode('chips')}
                >
                  Interactive Chips
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
                      }}
                      title={`Click to locate: "${ing.source_text}"`}
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
              <span>* Click any ingredient above to inspect its bounding box on the original package.</span>
            </div>
          </div>

          {/* Section 6: Nutrition Facts Table */}
          <div className="card-panel nutrition-card-panel">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon">📊</span>
                <h3 className="panel-title">Nutrition Facts</h3>
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
                    <th style={{ width: '38%' }}>Nutrient</th>
                    <th style={{ width: '22%', textAlign: 'right' }}>Per 100 g</th>
                    <th style={{ width: '22%', textAlign: 'right' }}>Per Serving</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.nutrition_facts).map(([key, fact], index) => {
                    const isMissing = fact.value === null;
                    const rowClass = isMissing ? 'row-missing' : (index % 2 === 0 ? 'row-even' : 'row-odd');
                    const formattedName = key.replace(/_/g, ' ');

                    return (
                      <tr key={key} className={rowClass}>
                        <td className="cell-nutrient">
                          <strong className="nutrient-label">{formattedName}</strong>
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
              <span className="disclaimer-icon">ℹ️</span>
              <p>
                UnPack strictly records unlisted nutrients as <strong>Not provided</strong> rather than assuming zero. Both per-100g and per-serving amounts are preserved independently.
              </p>
            </div>
          </div>

          {/* Section 7: Uncertainty & Completeness Insights */}
          {report.uncertainty_flags.length > 0 && (
            <div className="card-panel uncertainty-card-panel">
              <div className="panel-header">
                <div className="header-title-group">
                  <span className="header-icon">⚠️</span>
                  <h3 className="panel-title">Uncertainty & Completeness Flags</h3>
                </div>
                <span className="badge-pill">
                  {report.uncertainty_flags.length} {report.uncertainty_flags.length === 1 ? 'Notice' : 'Notices'}
                </span>
              </div>

              <div className="uncertainty-items-list">
                {report.uncertainty_flags.map((flag, i) => (
                  <div key={i} className="uncertainty-item">
                    <span className="warning-bullet">!</span>
                    <div className="uncertainty-content">
                      <p className="uncertainty-message">{flag}</p>
                      <span className="uncertainty-action">
                        Recommendation: Check physical package or retake photo if critical info is obscured.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Large Image Inspection */}
      {isLightboxOpen && previewUrl && (
        <div className="lightbox-backdrop" onClick={() => setIsLightboxOpen(false)}>
          <div className="lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div className="lightbox-title-group">
                <h4>Packaging Label Photo Inspection</h4>
                <span className="badge-pill">{report.quality.width}x{report.quality.height}px</span>
              </div>
              <button
                type="button"
                className="btn-lightbox-close"
                onClick={() => setIsLightboxOpen(false)}
              >
                ✕ Close
              </button>
            </div>
            <div className="lightbox-body">
              <img src={previewUrl} alt="High resolution food packaging" className="lightbox-img" />
            </div>
            <div className="lightbox-footer">
              <span>Use scroll or zoom to inspect small ingredients and nutrition typography.</span>
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
