import React, { useState, useRef } from 'react';
import { AppPage } from '../types/navigation';

interface ScanPageProps {
  onNavigate: (page: AppPage) => void;
}

export const ScanPage: React.FC<ScanPageProps> = ({ onNavigate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [analyzingState, setAnalyzingState] = useState<'idle' | 'simulating' | 'info'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAnalyzingState('idle');
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
    setAnalyzingState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSimulateAnalysis = () => {
    setAnalyzingState('simulating');
    setTimeout(() => {
      setAnalyzingState('info');
    }, 600);
  };

  return (
    <div className="page-content scan-page">
      <div className="page-header">
        <div className="brand-badge">Step 1 • Image Capture</div>
        <h1 className="page-title">Scan a Packaged Food Label</h1>
        <p className="page-subtitle">
          Capture or upload a clear photo showing the ingredients and nutrition facts table.
        </p>
      </div>

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

              <div className="preview-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClear}
                >
                  Replace Image
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSimulateAnalysis}
                  disabled={analyzingState === 'simulating'}
                >
                  {analyzingState === 'simulating' ? 'Verifying Image...' : 'Analyze Label'}
                </button>
              </div>

              {analyzingState === 'info' && (
                <div className="pipeline-notice">
                  <div className="notice-icon">ℹ️</div>
                  <div className="notice-content">
                    <strong>Milestone Notice:</strong> Label OCR and AI ingredient extraction
                    will be connected in <strong>Milestone 4</strong>. In accordance with project
                    guidelines, no simulated or fake OCR results are presented.
                  </div>
                </div>
              )}
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
                <strong>Avoid Glare & Crumples:</strong> Flatten rounded wrappers or reflective foil to prevent unreadable patches.
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
    </div>
  );
};
