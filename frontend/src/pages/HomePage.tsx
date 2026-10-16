import React from 'react';
import { AppPage } from '../types/navigation';

interface HomePageProps {
  onNavigate: (page: AppPage) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="page-content home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          <span>Know What's Inside</span>
        </div>

        <h1 className="hero-title">
          Understand What You Eat, <br />
          <span className="text-gradient">With Verifiable Evidence.</span>
        </h1>

        <p className="hero-subtitle">
          Unpack transforms complex packaged-food labels into transparent ingredient insights.
          Verify allergens against your personal restrictions, preview portion nutrition,
          and track what you eat—backed by exact label text, never AI hallucinations.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => onNavigate('scan')}
          >
            <span className="btn-icon">📷</span>
            <span>Scan a Food Label</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={() => onNavigate('nutrition')}
          >
            <span className="btn-icon">📊</span>
            <span>View Nutrition Tracker</span>
          </button>
        </div>

        <div className="hero-highlights">
          <div className="highlight-pill">
            <span className="highlight-check">✓</span>
            <span>Zero Fabricated Data</span>
          </div>
          <div className="highlight-pill">
            <span className="highlight-check">✓</span>
            <span>Explicit Allergen Evidence</span>
          </div>
          <div className="highlight-pill">
            <span className="highlight-check">✓</span>
            <span>Per 100g & Serving Calculations</span>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Built for Safety and Absolute Transparency</h2>
          <p className="section-subtitle">
            Most nutrition apps guess missing values or hide allergy alerts behind opaque scores.
            Unpack adheres to strict clinical and deterministic principles.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper icon-emerald">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3 className="feature-title">Verbatim Source Evidence</h3>
            <p className="feature-desc">
              Every detected ingredient and nutrient value is paired with the verbatim text extracted
              from the label. If text was cropped, blurry, or missing, Unpack marks it as unknown—never
              assumed safe.
            </p>
            <div className="feature-tags">
              <span className="tag">Exact Text Match</span>
              <span className="tag">Uncertainty Flags</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper icon-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="feature-title">Allergen & Diet Conflict Checks</h3>
            <p className="feature-desc">
              Unpack cross-references your dietary restrictions with the verified ingredients.
              We strictly separate explicit <em>contains</em> statements from precautionary
              <em>may contain</em> facility notices.
            </p>
            <div className="feature-tags">
              <span className="tag">No Hidden Warnings</span>
              <span className="tag">Precautionary Distinctions</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="6" x2="12" y2="12" />
                <line x1="12" y1="12" x2="16" y2="14" />
              </svg>
            </div>
            <h3 className="feature-title">Portion Preview & Confirmed Logging</h3>
            <p className="feature-desc">
              Previewing food never pollutes your history. See exactly how a 50g, 100g, or custom
              serving affects your daily nutrition. Only an explicit user confirmation logs the meal.
            </p>
            <div className="feature-tags">
              <span className="tag">Explicit Confirmation</span>
              <span className="tag">Per-Basis Math</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="how-it-works-section">
        <div className="section-header">
          <h2 className="section-title">How Unpack Works</h2>
          <p className="section-subtitle">
            Three simple steps from camera capture to verified nutritional impact.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">01</div>
            <h4 className="step-title">Capture or Select</h4>
            <p className="step-desc">
              Take a photo of the ingredient list and nutrition table using your camera or upload an image file.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-number">02</div>
            <h4 className="step-title">Inspect Findings</h4>
            <p className="step-desc">
              Review extracted ingredients, nutrition basis (per 100g vs per serving), and any dietary conflict alerts.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-number">03</div>
            <h4 className="step-title">Preview & Confirm</h4>
            <p className="step-desc">
              Adjust your consumed portion, inspect the nutrient contribution, and explicitly confirm to log it to your daily ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="cta-banner">
        <div className="cta-content">
          <h3 className="cta-title">Ready to verify your first food label?</h3>
          <p className="cta-desc">
            Try uploading a sample label photo to see the scanner layout and preview interface.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('scan')}
          >
            Launch Food Label Scanner
          </button>
        </div>
      </section>
    </div>
  );
};
