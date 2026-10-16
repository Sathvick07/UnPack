import React, { useState } from 'react';
import { LabelAnalysisReport, ExtractedIngredient, NutritionFact, CompatibilityFinding } from '../types/label';
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
          status: 'CONFLICT DETECTED',
          severity: 'CRITICAL' as const,
          explanation: `Manually confirmed by user: Contains ${restriction}.`,
          evidence: 'User manual confirmation',
          requires_manual_confirmation: false,
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
          status: 'NO CONFLICT IDENTIFIED IN READABLE INFORMATION',
          severity: 'INFO' as const,
          explanation: `Manually checked by user: Confirmed free from ${restriction}.`,
          evidence: 'User visual verification',
          requires_manual_confirmation: false,
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
            status: 'CONFLICT DETECTED',
            severity: 'CRITICAL' as const,
            explanation: `Ingredient matching '${f.restriction}' found in verified ingredients.`,
            evidence: updatedIngredients.find((ing) => ing.name.toLowerCase().includes(rest))?.name || '',
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
  const conflictCount = allergenFindings.filter((f) => f.status === 'CONFLICT DETECTED').length;
  const uncertainCount = allergenFindings.filter((f) => f.status.includes('UNKNOWN') || f.status.includes('PRECAUTIONARY')).length;

  // Extract shared packaging allergen statements (e.g. "CONTAINS MILK, WHEAT AND SOY.")
  const sharedAllergenStatements = Array.from(
    new Set(
      report.allergen_statements
        .map((s) => s.source_text?.trim())
        .filter(Boolean)
    )
  );

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
                  <img
                    src={previewUrl}
                    alt="Uploaded food packaging label"
                    className="label-evidence-photo"
                  />
                  {selectedIngredient?.bounding_box && (
                    <div
                      className="bounding-box-overlay"
                      style={{
                        top: `${selectedIngredient.bounding_box[0] * 100}%`,
                        left: `${selectedIngredient.bounding_box[1] * 100}%`,
                        height: `${(selectedIngredient.bounding_box[2] - selectedIngredient.bounding_box[0]) * 100}%`,
                        width: `${(selectedIngredient.bounding_box[3] - selectedIngredient.bounding_box[1]) * 100}%`,
                      }}
                    >
                      <span className="overlay-tag">{selectedIngredient.name}</span>
                    </div>
                  )}
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
                  {selectedIngredient
                    ? `Inspecting: "${selectedIngredient.name}" (Highlighted on label)`
                    : 'Click any extracted ingredient to locate it on the packaging'}
                </span>
                {selectedIngredient && (
                  <button
                    type="button"
                    className="btn-clear-selection"
                    onClick={() => setSelectedIngredient(null)}
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
                <span className="section-label">Scan Summary</span>
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
              </div>
            </div>

            <p className="summary-description">
              {conflictCount > 0
                ? `Safety warning: Found ${conflictCount} confirmed dietary conflict${conflictCount > 1 ? 's' : ''} with your active restrictions. Check packaging details below before consuming.`
                : uncertainCount > 0
                ? 'Notice: Certain fields or text sections could not be legibly resolved. Review uncertain items and verify physical packaging.'
                : 'No dietary conflicts identified in readable information. Core nutrients and verified ingredients have been extracted below.'}
            </p>
          </div>

          {/* Section 2: Compact Allergen Safety Summary */}
          <div className="card-panel allergen-safety-card">
            <div className="panel-header">
              <div className="header-title-group">
                <span className="header-icon">🛡️</span>
                <h3 className="panel-title">Allergen Safety Summary</h3>
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

            {/* Compact Allergen Rows */}
            <div className="allergen-items-list">
              {allergenFindings.map((finding) => {
                const fid = finding.id || finding.restriction || 'unknown';
                const isExpanded = !!expandedFindings[fid];
                const isConflict = finding.status === 'CONFLICT DETECTED';
                const isPrecautionary = finding.status.includes('PRECAUTIONARY');
                const isUnknown = finding.status.includes('UNKNOWN');

                const rowStatusClass = isConflict
                  ? 'row-status-conflict'
                  : isPrecautionary
                  ? 'row-status-precautionary'
                  : isUnknown
                  ? 'row-status-unknown'
                  : 'row-status-clear';

                const badgeText = isConflict
                  ? 'Confirmed Match'
                  : isPrecautionary
                  ? 'Precautionary Notice'
                  : isUnknown
                  ? 'Uncertain — Verify'
                  : 'Not Found in Readable Info';

                return (
                  <div key={fid} className={`allergen-row ${rowStatusClass}`}>
                    <div className="allergen-row-header">
                      <div className="allergen-name-block">
                        <span className="allergen-indicator-dot" />
                        <strong className="allergen-title">
                          {finding.display_name || finding.restriction}
                        </strong>
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
                        {finding.evidence && (
                          <div className="details-evidence">
                            <strong>Source Evidence:</strong> "{finding.evidence}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Extracted Ingredients */}
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
                      onClick={() => setSelectedIngredient(isSelected ? null : ing)}
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

          {/* Section 4: Nutrition Facts Table */}
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

          {/* Section 5: Uncertainty & Completeness Insights */}
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
