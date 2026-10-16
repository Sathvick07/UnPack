import React, { useState } from 'react';
import { LabelAnalysisReport, ExtractedIngredient, NutritionFact } from '../types/label';
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

  const handleSaveEdits = (
    updatedIngredients: ExtractedIngredient[],
    updatedNutrition: Record<string, NutritionFact>
  ) => {
    // Re-check findings against restrictions with edited fields
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
  };

  return (
    <div className="evidence-lens-container">
      {/* 1. Image Quality Warning Banner & Radar */}
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

      <div className="evidence-split-layout">
        {/* Left Column: Packaging Image & Physical Evidence */}
        <div className="evidence-image-pane">
          <div className="pane-header">
            <h3 className="pane-title">Physical Label Evidence</h3>
            <span className="badge-outline">{report.quality.format} • {report.quality.width}x{report.quality.height}px</span>
          </div>

          <div className="image-viewer-card">
            {previewUrl && (
              <div className="image-wrapper">
                <img src={previewUrl} alt="Uploaded packaging label" className="evidence-image" />
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
              </div>
            )}
            <div className="image-viewer-footer">
              <span className="viewer-hint">
                {selectedIngredient
                  ? `Selected: "${selectedIngredient.name}" (Click an ingredient to highlight)`
                  : 'Click any extracted ingredient below to inspect supporting text'}
              </span>
            </div>
          </div>

          {/* Uncertainty Flags Summary */}
          {report.uncertainty_flags.length > 0 && (
            <div className="uncertainty-box">
              <h4 className="uncertainty-title">Uncertainty & Completeness Flags</h4>
              <ul className="uncertainty-list">
                {report.uncertainty_flags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Compatibility Findings & Structured Fields */}
        <div className="evidence-findings-pane">
          <div className="pane-header">
            <h3 className="pane-title">Compatibility & Findings</h3>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setIsEditModalOpen(true)}
            >
              ✏️ Edit Extracted Fields
            </button>
          </div>

          {/* Findings List */}
          <div className="findings-group">
            {report.findings.map((f, i) => {
              const statusClass =
                f.status === 'CONFLICT DETECTED'
                  ? 'finding-conflict'
                  : f.status.includes('PRECAUTIONARY')
                  ? 'finding-precautionary'
                  : f.status.includes('UNKNOWN')
                  ? 'finding-unknown'
                  : 'finding-clear';

              return (
                <div key={i} className={`finding-card ${statusClass}`}>
                  <div className="finding-header">
                    <span className="finding-status-badge">{f.status}</span>
                    <span className="finding-target">{f.restriction || f.target}</span>
                  </div>
                  <p className="finding-desc">{f.explanation}</p>
                  {f.evidence && (
                    <div className="finding-evidence-quote">
                      <strong>Source Evidence:</strong> "{f.evidence}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Extracted Ingredients with status tags */}
          <div className="ingredients-review-section">
            <h4 className="subpane-title">
              Verified Ingredients ({report.ingredients.length})
            </h4>
            <div className="ingredients-pills">
              {report.ingredients.map((ing, i) => {
                const isSelected = selectedIngredient?.name === ing.name;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`ingredient-pill pill-status-${ing.status} ${isSelected ? 'pill-selected' : ''}`}
                    onClick={() => setSelectedIngredient(isSelected ? null : ing)}
                    title={`Source: "${ing.source_text}"`}
                  >
                    <span>{ing.name}</span>
                    {ing.status !== 'detected' && (
                      <span className="pill-status-tag">{ing.status}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nutrition Facts Table with Safe Missing-Value Handling */}
          <div className="nutrition-review-section">
            <h4 className="subpane-title">Nutrition Facts Table</h4>
            <div className="nutrition-table-wrapper">
              <table className="nutrition-table">
                <thead>
                  <tr>
                    <th>Nutrient</th>
                    <th>Extracted Amount</th>
                    <th>Basis</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.nutrition_facts).map(([key, fact]) => {
                    const isMissing = fact.value === null;
                    return (
                      <tr key={key} className={isMissing ? 'row-missing' : 'row-present'}>
                        <td className="nutrient-name">{key.toUpperCase()}</td>
                        <td className="nutrient-val">
                          {isMissing ? (
                            <span className="missing-val-badge">Not Provided on Label</span>
                          ) : (
                            <strong>{fact.value} {fact.unit}</strong>
                          )}
                        </td>
                        <td className="nutrient-basis">{fact.basis}</td>
                        <td>
                          <span className={`status-cell status-${fact.status}`}>
                            {fact.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-caption">
              * Note: Unpack strictly records missing values as <em>Not Provided</em> rather than
              assuming zero.
            </p>
          </div>
        </div>
      </div>

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
