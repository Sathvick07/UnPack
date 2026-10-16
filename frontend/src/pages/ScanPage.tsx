import React, { useState, useRef } from 'react';
import { AppPage } from '../types/navigation';
import { LabelAnalysisReport } from '../types/label';
import { analyzeLabel, verifyFields } from '../api/client';
import { EvidenceLens } from '../components/EvidenceLens';

interface ScanPageProps {
  onNavigate: (page: AppPage) => void;
}

const COMMON_RESTRICTIONS = [
  { id: 'peanut', label: 'Peanuts' },
  { id: 'tree_nut', label: 'Tree Nuts' },
  { id: 'milk', label: 'Dairy / Milk' },
  { id: 'gluten', label: 'Gluten / Wheat' },
  { id: 'egg', label: 'Eggs' },
  { id: 'soy', label: 'Soy' },
  { id: 'shellfish', label: 'Shellfish' },
];

export const ScanPage: React.FC<ScanPageProps> = ({ onNavigate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<LabelAnalysisReport | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>(['peanut', 'tree_nut']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleRestriction = async (id: string) => {
    const updated = restrictions.includes(id)
      ? restrictions.filter((r) => r !== id)
      : [...restrictions, id];
    setRestrictions(updated);

    if (analysisReport) {
      try {
        const reevaluated = await verifyFields({
          ingredients: analysisReport.ingredients,
          allergen_statements: analysisReport.allergen_statements,
          nutrition_facts: analysisReport.nutrition_facts,
          restrictions: updated,
          targets: {},
          raw_text: analysisReport.raw_text,
          quality_tier: analysisReport.quality.quality_tier,
        });
        setAnalysisReport({
          ...analysisReport,
          findings: reevaluated.findings,
          manual_confirmation_needed: reevaluated.manual_confirmation_needed,
        });
      } catch (err) {
        console.error('Failed to re-evaluate restrictions:', err);
      }
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit. Please choose a smaller file.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setAnalysisReport(null);
    setAnalysisError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisReport(null);
    setAnalysisError(null);
    setIsAnalyzing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const report = await analyzeLabel(selectedFile, restrictions);
      setAnalysisReport(report);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to analyze food label. Please check your network connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="page-content scan-page">
      <div className="page-header">
        <div className="brand-badge">Mission 2 • LabelLens Engine</div>
        <h1 className="page-title">Food Label & Evidence Scanner</h1>
        <p className="page-subtitle">
          Capture or upload a label photo. UnPack analyzes ingredients, detects image defects or curvature,
          and transparently flags uncertainty.
        </p>
      </div>

      {!analysisReport ? (
        <div className="scan-layout">
          <div className="scan-card">
            {!previewUrl ? (
              <div
                className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <h3 className="dropzone-title">Click to upload or drag & drop</h3>
                <p className="dropzone-text">Supports JPG, PNG, and WebP (up to 10MB)</p>
                <span className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>
                  Browse Files
                </span>
              </div>
            ) : (
              <div className="preview-container">
                <div className="preview-header">
                  <span className="preview-badge">Label Preview</span>
                  <span className="preview-file-name">{selectedFile?.name}</span>
                  <span className="preview-file-size">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </div>

                <div className="preview-media-box">
                  <img src={previewUrl} alt="Food label preview" className="preview-image" />
                </div>

                {/* Dietary Restriction Tag Picker */}
                <div className="restrictions-selector" style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    <strong>Select Dietary Restrictions to Check Against:</strong>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {COMMON_RESTRICTIONS.map((res) => {
                      const isActive = restrictions.includes(res.id);
                      return (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => toggleRestriction(res.id)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: isActive ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                            color: isActive ? '#34d399' : 'var(--text-secondary)',
                          }}
                        >
                          {isActive ? '✓ ' : '+ '}
                          {res.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {analysisError && (
                  <div className="pipeline-notice" style={{ marginTop: '1rem', borderLeftColor: '#ef4444' }}>
                    <div className="notice-icon">⚠️</div>
                    <div className="notice-content">
                      <strong>Analysis Failed:</strong> {analysisError}
                    </div>
                  </div>
                )}

                <div className="preview-actions" style={{ marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClear}
                    disabled={isAnalyzing}
                  >
                    Replace Image
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing via LabelLens...' : 'Analyze Label'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Photography Tips Card */}
          <div className="tips-card">
            <h3 className="tips-title">Guidelines for Clear Label Reading</h3>
            <ul className="tips-list">
              <li>
                <div className="tip-bullet">1</div>
                <div>
                  <strong>Ingredients Section:</strong> Ensure the ingredient list is completely
                  visible from the first word to the end period.
                </div>
              </li>
              <li>
                <div className="tip-bullet">2</div>
                <div>
                  <strong>Nutrition Facts Table:</strong> Include the serving size, basis (per 100g or per serving),
                  and energy/macronutrient columns.
                </div>
              </li>
              <li>
                <div className="tip-bullet">3</div>
                <div>
                  <strong>Allergen Statements:</strong> Keep "Contains..." and "May contain..." notices
                  in clear focus.
                </div>
              </li>
              <li>
                <div className="tip-bullet">4</div>
                <div>
                  <strong>Curved & Cylinder Packaging:</strong> Rotate bottles and cans so text is not wrapped
                  out of line-of-sight.
                </div>
              </li>
            </ul>

            <div className="tips-footer">
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={() => onNavigate('home')}
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClear}
            >
              ← Scan Another Label
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Completed in LabelLens engine
            </span>
          </div>

          {/* Active Dietary Restrictions Selector Bar (Preserved on Results Page) */}
          <div
            className="active-restrictions-bar"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Active Allergy Check ({restrictions.length} selected):
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Click chips to toggle live re-evaluation
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {COMMON_RESTRICTIONS.map((res) => {
                const isActive = restrictions.includes(res.id);
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => toggleRestriction(res.id)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '16px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: isActive ? '1px solid #10b981' : '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                      color: isActive ? '#34d399' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isActive ? '✓ ' : '+ '}
                    {res.label}
                  </button>
                );
              })}
            </div>
          </div>

          <EvidenceLens
            report={analysisReport}
            previewUrl={previewUrl}
            onRetake={handleClear}
            onUpdateReport={setAnalysisReport}
          />
        </div>
      )}
    </div>
  );
};
