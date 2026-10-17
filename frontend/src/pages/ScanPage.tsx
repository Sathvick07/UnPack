import React, { useState, useRef, useEffect } from 'react';
import { AppPage } from '../types/navigation';
import { LabelAnalysisReport } from '../types/label';
import { analyzeLabel, verifyFields, updateUserProfile } from '../api/client';
import { EvidenceLens } from '../components/EvidenceLens';
import { RecordConsumptionModal } from '../components/RecordConsumptionModal';
import { StatusAlert } from '../components/StatusAlert';
import { useAuth } from '../context/AuthContext';

interface ScanPageProps {
  onNavigate: (page: AppPage, options?: { sectionId?: string; analysisId?: string }) => void;
  onScanCompleted?: (report: LabelAnalysisReport, fileName: string) => void;
  onClearPendingScan?: () => void;
  targetSectionId?: string | null;
  targetAnalysisId?: string | null;
  isConsumptionConfirmed?: boolean;
  onRequestOpenRecordModal?: () => void;
}

const COMMON_RESTRICTIONS = [
  { id: 'peanut', label: 'Peanuts' },
  { id: 'tree_nut', label: 'Tree Nuts' },
  { id: 'milk', label: 'Dairy / Milk' },
  { id: 'gluten', label: 'Gluten / Wheat' },
  { id: 'egg', label: 'Eggs' },
  { id: 'soy', label: 'Soy' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'fish', label: 'Fish' },
  { id: 'sesame', label: 'Sesame' },
];

export const ScanPage: React.FC<ScanPageProps> = ({
  onNavigate,
  onScanCompleted,
  onClearPendingScan,
  targetSectionId = null,
  targetAnalysisId = null,
  isConsumptionConfirmed: externalConsumptionConfirmed,
  onRequestOpenRecordModal,
}) => {
  const { user, token, isAuthenticated, updateUserContext } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<LabelAnalysisReport | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [recordSuccessMsg, setRecordSuccessMsg] = useState<string | null>(null);
  const [localConsumptionConfirmed, setLocalConsumptionConfirmed] = useState<boolean>(false);
  const isConsumptionConfirmed = externalConsumptionConfirmed !== undefined
    ? externalConsumptionConfirmed
    : localConsumptionConfirmed;
  const setIsConsumptionConfirmed = setLocalConsumptionConfirmed;
  const [isScanDismissed, setIsScanDismissed] = useState<boolean>(false);

  // Load saved preferences if available
  const [restrictions, setRestrictions] = useState<string[]>(() => {
    if (user?.profile?.allergies && user.profile.allergies.length > 0) {
      return user.profile.allergies;
    }
    return ['peanut', 'tree_nut'];
  });

  const [isSavingPrefs, setIsSavingPrefs] = useState<boolean>(false);
  const [prefSaveMsg, setPrefSaveMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync restrictions whenever user profile updates
  useEffect(() => {
    if (user?.profile?.allergies && user.profile.allergies.length > 0) {
      setRestrictions(user.profile.allergies);
    }
  }, [user?.profile?.allergies]);

  // Recover active unrecorded scan from sessionStorage if user refreshed
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('unpack_active_unrecorded_scan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.report && !analysisReport) {
          setAnalysisReport(parsed.report);
          onScanCompleted?.(parsed.report, parsed.fileName || 'Active Product');
        }
      }
    } catch {}
  }, []);

  // Smooth scroll and spotlight pulse when targetSectionId is supplied
  useEffect(() => {
    if (analysisReport && targetSectionId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(targetSectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const sectionCard = el.closest('.analysis-section-card') || el;
          sectionCard.classList.remove('section-nav-spotlight');
          void (sectionCard as HTMLElement).offsetWidth;
          sectionCard.classList.add('section-nav-spotlight');
          setTimeout(() => {
            sectionCard.classList.remove('section-nav-spotlight');
          }, 2200);
        }
      }, 160);
      return () => clearTimeout(timer);
    }
  }, [analysisReport, targetSectionId]);

  // Save active unrecorded scan to sessionStorage and register native beforeunload
  useEffect(() => {
    const isPending = analysisReport && !isConsumptionConfirmed && !isScanDismissed;
    if (isPending) {
      try {
        sessionStorage.setItem(
          'unpack_active_unrecorded_scan',
          JSON.stringify({
            report: analysisReport,
            fileName: selectedFile?.name || analysisReport.file_name || 'Active Product',
          })
        );
      } catch {}

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      sessionStorage.removeItem('unpack_active_unrecorded_scan');
    }
  }, [analysisReport, isConsumptionConfirmed, isScanDismissed, selectedFile]);

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
          contradictions: reevaluated.contradictions || analysisReport.contradictions,
          ambiguous_ingredients: reevaluated.ambiguous_ingredients || analysisReport.ambiguous_ingredients,
          uncertainty_flags: reevaluated.uncertainty_flags || analysisReport.uncertainty_flags,
          manual_confirmation_needed: reevaluated.manual_confirmation_needed,
        });
      } catch (err) {
        console.error('Failed to re-evaluate restrictions:', err);
      }
    }
  };

  const handleSavePreferencesToProfile = async () => {
    if (!token || !isAuthenticated) {
      onNavigate('login');
      return;
    }
    setIsSavingPrefs(true);
    setPrefSaveMsg(null);
    try {
      const res = await updateUserProfile(token, {
        allergies: restrictions,
        allergy_status: restrictions.length > 0 ? 'specified' : 'none',
      });
      updateUserContext(res.profile);
      setPrefSaveMsg('Saved to your profile!');
      setTimeout(() => setPrefSaveMsg(null), 3000);
    } catch {
      setPrefSaveMsg('Failed to save preferences.');
    } finally {
      setIsSavingPrefs(false);
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
    setIsConsumptionConfirmed(false);
    setRecordSuccessMsg(null);
    setIsScanDismissed(false);
    sessionStorage.removeItem('unpack_active_unrecorded_scan');
    onClearPendingScan?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsConsumptionConfirmed(false);
    setRecordSuccessMsg(null);
    setIsScanDismissed(false);

    try {
      const report = await analyzeLabel(selectedFile, restrictions);
      setAnalysisReport(report);
      onScanCompleted?.(report, selectedFile.name);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to analyze food label. Please check your network connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const displayName = user?.profile?.full_name?.trim() || user?.email?.split('@')[0];

  return (
    <div className="page-content scan-page">
      <div className="page-header">
        <div className="brand-badge">UnPack • LabelLens Engine</div>
        <h1 className="page-title">Food Label & Evidence Scanner</h1>
        <p className="page-subtitle">
          Capture or upload a label photo. UnPack analyzes ingredients, detects image defects or curvature,
          and transparently flags uncertainty.
        </p>

        {/* Personalized User Greeting & Preferences Banner */}
        {isAuthenticated ? (
          <div className="scan-user-greeting-banner">
            <div className="greeting-text-block">
              <span style={{ fontSize: '1.25rem' }}>👋</span>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                  Welcome, {displayName}!
                </strong>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Your saved allergen profile is active ({restrictions.length} restrictions selected).
                </p>
              </div>
            </div>
            <div className="greeting-actions-block">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('onboarding')}
                style={{ fontSize: '0.8rem' }}
              >
                Manage Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="scan-user-greeting-banner guest-mode">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              💡 <strong>Guest mode:</strong> Create an account to permanently sync your personal allergens and dietary goals.
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('register')}
              style={{ fontSize: '0.8rem' }}
            >
              Sign Up Free
            </button>
          </div>
        )}
      </div>

      {/* Fallback Banner when navigated to a specific alert/section but analysis is not loaded */}
      {!analysisReport && (targetSectionId || targetAnalysisId) && (
        <div style={{ marginBottom: '1.25rem' }}>
          <StatusAlert
            type="info"
            title="Analysis Report Not Found"
            message={
              targetAnalysisId
                ? `Saved report for "${targetAnalysisId}" was not found in active session. Please upload or scan the packaging label to inspect its evidence.`
                : 'You navigated to an alert finding, but no active label analysis is loaded in this session. Please upload or scan a food label to view evidence.'
            }
            action={{
              label: 'Upload Food Label Photo',
              onClick: () => fileInputRef.current?.click(),
              variant: 'primary',
            }}
          />
        </div>
      )}

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
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <h3 className="dropzone-title">Upload food label or take photo</h3>
                <p className="dropzone-text">Supports JPG, PNG, and WebP (up to 10MB)</p>
                <div className="dropzone-actions-group" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Browse Files
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-camera-trigger"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    📷 Take Photo
                  </button>
                </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                      <strong>Select Dietary Restrictions to Check Against:</strong>
                    </label>
                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={handleSavePreferencesToProfile}
                        disabled={isSavingPrefs}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {isSavingPrefs ? 'Saving...' : prefSaveMsg || 'Save as my profile default'}
                      </button>
                    )}
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
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            background: isActive ? 'var(--color-lime-bg)' : 'var(--bg-primary)',
                            border: isActive ? '1px solid var(--color-lime)' : '1px solid var(--border-subtle)',
                            color: isActive ? 'var(--brand-forest)' : 'var(--text-secondary)',
                            fontWeight: isActive ? 700 : 500,
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

                {analysisError && (
                  <div style={{ marginTop: '1rem' }}>
                    <StatusAlert
                      type="error"
                      title="Food Label Analysis Failed"
                      message={analysisError}
                      onRetry={handleAnalyze}
                      retryLabel="Retry Analysis"
                      onDismiss={() => setAnalysisError(null)}
                    />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClear}
              >
                ← Scan Another Label
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (onRequestOpenRecordModal) {
                    onRequestOpenRecordModal();
                  } else {
                    setIsRecordModalOpen(true);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>🥗</span>
                <span>{isConsumptionConfirmed ? 'Log Another Portion' : 'Record Consumption'}</span>
              </button>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Completed in LabelLens engine
            </span>
          </div>

          {/* Consumption Status Banners */}
          {isConsumptionConfirmed && recordSuccessMsg && (
            <div style={{ marginBottom: '1.25rem' }}>
              <StatusAlert
                type="success"
                title="Product Confirmed to Daily Ledger"
                message={recordSuccessMsg}
                action={{
                  label: 'View Daily Limits →',
                  onClick: () => onNavigate('nutrition'),
                  variant: 'primary',
                }}
                onDismiss={() => setRecordSuccessMsg(null)}
              />
            </div>
          )}

          {/* Active Dietary Restrictions Selector Bar (Preserved on Results Page) */}
          <div
            className="active-restrictions-bar"
            style={{
              background: 'var(--bg-card)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-subtle)',
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
                      background: isActive ? 'var(--color-lime-bg)' : 'var(--bg-primary)',
                      border: isActive ? '1px solid var(--color-lime)' : '1px solid var(--border-subtle)',
                      color: isActive ? 'var(--brand-forest)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500,
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
            onNavigateToLedger={() => onNavigate('nutrition')}
            onRecordConsumption={() => {
              if (onRequestOpenRecordModal) {
                onRequestOpenRecordModal();
              } else {
                setIsRecordModalOpen(true);
              }
            }}
            isConsumptionConfirmed={isConsumptionConfirmed}
            recordSuccessMsg={recordSuccessMsg}
            onNavigateToSection={(secId, repId) => {
              onNavigate('scan', { sectionId: secId, analysisId: repId });
            }}
          />

          <RecordConsumptionModal
            report={analysisReport}
            defaultProductName={selectedFile?.name || ''}
            isOpen={isRecordModalOpen}
            onClose={() => setIsRecordModalOpen(false)}
            onSuccess={(msg) => {
              setIsConsumptionConfirmed(true);
              setRecordSuccessMsg(msg);
              onClearPendingScan?.();
            }}
          />
        </div>
      )}
    </div>
  );
};
