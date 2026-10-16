import React from 'react';
import { AppPage } from '../types/navigation';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  onNavigate: (page: AppPage) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { isAuthenticated } = useAuth();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="page-content home-page">
      {/* ====================================================================
          PHASE 3: Responsive Two-Column Hero Section
          ==================================================================== */}
      <section className="hero-two-column-section" aria-label="Hero Section">
        <div className="hero-columns-container">
          {/* Left Column: Headline, Copy & CTAs */}
          <div className="hero-text-column">
            <div className="hero-eyebrow-badge">
              <span className="eyebrow-dot"></span>
              <span>MAKE INFORMED FOOD CHOICES</span>
            </div>

            <h1 className="hero-main-headline">
              Look closer. <br />
              <span className="hero-headline-highlight">Choose smarter.</span>
            </h1>

            <p className="hero-supporting-description">
              A food label can tell you more than you think. Scan ingredients, spot
              potential allergens, and understand nutrition in a way that makes sense for you.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => onNavigate(isAuthenticated ? 'scan' : 'register')}
                id="hero-get-started-btn"
              >
                <span>{isAuthenticated ? 'Open Scanner' : 'Get Started'}</span>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-large"
                onClick={() => scrollToSection('how-it-works')}
                id="hero-how-it-works-btn"
              >
                <span>See How It Works</span>
              </button>
            </div>

            {/* Below-CTA Trust Copy */}
            <div className="hero-trust-message">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Clearer labels. More informed choices.</span>
            </div>
          </div>

          {/* Right Column: Polished Product Visual (Label + Mobile Scanning Device) */}
          <div className="hero-visual-column">
            <div className="hero-mockup-stage">
              {/* Background decorative soft glow */}
              <div className="mockup-ambient-glow" aria-hidden="true"></div>

              {/* Package Label Card Preview */}
              <div className="package-label-backdrop">
                <div className="label-backdrop-header">
                  <span className="label-chip">Packaged Food Label</span>
                  <span className="label-net-weight">Net Wt 150g</span>
                </div>
                <div className="label-fake-barcode">
                  <span>||| | | || ||| || | ||| || |||</span>
                </div>
                <div className="label-sample-nutrition">
                  <div className="mini-nutrient">
                    <span className="nutrient-lbl">Energy</span>
                    <span className="nutrient-val">480 kcal</span>
                  </div>
                  <div className="mini-nutrient">
                    <span className="nutrient-lbl">Protein</span>
                    <span className="nutrient-val">8.5 g</span>
                  </div>
                  <div className="mini-nutrient">
                    <span className="nutrient-lbl">Carbs</span>
                    <span className="nutrient-val">58.0 g</span>
                  </div>
                </div>
              </div>

              {/* Mobile Phone Mockup Showing UnPack Scanning Screen */}
              <div className="mobile-phone-frame">
                {/* Phone Speaker/Camera Notch */}
                <div className="phone-notch">
                  <span className="notch-speaker"></span>
                  <span className="notch-camera"></span>
                </div>

                {/* Viewfinder Screen */}
                <div className="phone-screen">
                  {/* Viewfinder Status Bar */}
                  <div className="screen-top-bar">
                    <span className="screen-brand">UnPack Lens</span>
                    <span className="screen-badge-live">LIVE OCR</span>
                  </div>

                  {/* Scanning Frame with Green Corner Marks */}
                  <div className="scanner-viewfinder">
                    <div className="viewfinder-corner top-left"></div>
                    <div className="viewfinder-corner top-right"></div>
                    <div className="viewfinder-corner bottom-left"></div>
                    <div className="viewfinder-corner bottom-right"></div>

                    {/* Laser Scanning Line Animation */}
                    <div className="scanner-laser-line"></div>

                    {/* In-Frame Label Preview */}
                    <div className="viewfinder-content">
                      <div className="viewfinder-text-line high">INGREDIENTS: Whole grain oats,</div>
                      <div className="viewfinder-text-line alert">roasted peanuts, cane sugar,</div>
                      <div className="viewfinder-text-line">sea salt, almond flour.</div>
                    </div>
                  </div>

                  {/* Screen Instant Findings Preview */}
                  <div className="screen-bottom-card">
                    <div className="screen-card-header">
                      <span className="screen-status-dot dot-alert"></span>
                      <strong className="screen-status-text">Allergen Detected</strong>
                      <span className="screen-clarity">Score 92/100</span>
                    </div>
                    <p className="screen-card-detail">
                      Matches your restriction: <strong>Peanuts</strong> (explicitly verified).
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanatory Floating Callout 1 */}
              <div className="hero-floating-callout callout-top">
                <span className="callout-icon">📷</span>
                <div className="callout-text">
                  <strong>Scan the label</strong>
                  <span>Instant OCR verification</span>
                </div>
              </div>

              {/* Explanatory Floating Callout 2 */}
              <div className="hero-floating-callout callout-bottom">
                <span className="callout-icon">🛡️</span>
                <div className="callout-text">
                  <strong>Understand what matters</strong>
                  <span>Customized to your allergies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PHASE 3: Features Section
          ==================================================================== */}
      <section className="features-section" id="features" aria-label="Core Capabilities">
        <div className="section-header">
          <span className="section-eyebrow">DESIGNED FOR CLARITY</span>
          <h2 className="section-title">Built for Food Safety and Transparency</h2>
          <p className="section-subtitle">
            Most nutrition tools guess missing values or hide allergy alerts behind opaque scores.
            UnPack adheres strictly to verbatim evidence and clinical safety principles.
          </p>
        </div>

        <div className="features-cards-grid">
          {/* Card 1: Food label scanning */}
          <div className="feature-modern-card">
            <div className="feature-card-icon icon-forest">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </div>
            <h3 className="feature-card-title">Food Label Scanning</h3>
            <p className="feature-card-text">
              High-accuracy multimodal OCR analyzes packaged food labels, curved wrappers, and nutrient tables directly from photos.
            </p>
            <div className="feature-card-footer">
              <span className="pill-tag">Camera & Upload</span>
              <span className="pill-tag">Curved Label Detection</span>
            </div>
          </div>

          {/* Card 2: Ingredient analysis */}
          <div className="feature-modern-card">
            <div className="feature-card-icon icon-lime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3 className="feature-card-title">Ingredient Analysis</h3>
            <p className="feature-card-text">
              Verbatim extraction parses every ingredient clause, separating explicit <em>contains</em> declarations from precautionary facility warnings.
            </p>
            <div className="feature-card-footer">
              <span className="pill-tag">Verbatim Text</span>
              <span className="pill-tag">Clause Parsing</span>
            </div>
          </div>

          {/* Card 3: Allergen awareness */}
          <div className="feature-modern-card">
            <div className="feature-card-icon icon-rose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="feature-card-title">Allergen Awareness</h3>
            <p className="feature-card-text">
              Deterministic matching cross-references extracted ingredients against your saved personal allergies and food intolerances.
            </p>
            <div className="feature-card-footer">
              <span className="pill-tag">Deterministic Rules</span>
              <span className="pill-tag">Personalized Flags</span>
            </div>
          </div>

          {/* Card 4: Nutrition facts */}
          <div className="feature-modern-card">
            <div className="feature-card-icon icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3 className="feature-card-title">Nutrition Facts</h3>
            <p className="feature-card-text">
              Explicit extraction of Energy, Protein, Carbohydrates, Fat, and Sodium. If a nutrient was omitted on the package, UnPack marks it missing—never fabricated.
            </p>
            <div className="feature-card-footer">
              <span className="pill-tag">Zero Hallucinations</span>
              <span className="pill-tag">Per 100g & Serving</span>
            </div>
          </div>

          {/* Card 5: Evidence & uncertainty handling */}
          <div className="feature-modern-card">
            <div className="feature-card-icon icon-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="feature-card-title">Evidence & Uncertainty</h3>
            <p className="feature-card-text">
              Clarity score evaluation warns of blur, glare, or severe angle distortion, advising a retake when text is unreadable or uncertain.
            </p>
            <div className="feature-card-footer">
              <span className="pill-tag">Laplacian Blur Check</span>
              <span className="pill-tag">Manual Confirmation</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PHASE 3: How It Works Section
          ==================================================================== */}
      <section className="how-it-works-modern-section" id="how-it-works" aria-label="How It Works">
        <div className="section-header">
          <span className="section-eyebrow">SIMPLE THREE-STEP PROCESS</span>
          <h2 className="section-title">How UnPack Works</h2>
          <p className="section-subtitle">
            From physical package to clear nutritional clarity in three transparent steps.
          </p>
        </div>

        <div className="three-step-grid">
          {/* Step 1 */}
          <div className="modern-step-card">
            <div className="step-card-number">01</div>
            <div className="step-card-content">
              <h4 className="step-card-title">Scan the package label</h4>
              <p className="step-card-desc">
                Take a clear photo of the ingredient list and nutrition table using your camera,
                or upload an image from your device.
              </p>
            </div>
          </div>

          <div className="step-divider-arrow" aria-hidden="true">→</div>

          {/* Step 2 */}
          <div className="modern-step-card">
            <div className="step-card-number">02</div>
            <div className="step-card-content">
              <h4 className="step-card-title">Review extracted ingredients and nutrition</h4>
              <p className="step-card-desc">
                Review OCR extraction side-by-side with your image. Edit or confirm values with
                one click if a label has unusual formatting.
              </p>
            </div>
          </div>

          <div className="step-divider-arrow" aria-hidden="true">→</div>

          {/* Step 3 */}
          <div className="modern-step-card">
            <div className="step-card-number">03</div>
            <div className="step-card-content">
              <h4 className="step-card-title">Check relevant allergen information and evidence</h4>
              <p className="step-card-desc">
                Inspect deterministic compatibility findings matched to your profile, supported
                by highlighted verbatim text excerpts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PHASE 3: Preview Section (LabelLens Results Dashboard Preview)
          ==================================================================== */}
      <section className="preview-dashboard-section" id="preview" aria-label="LabelLens Results Preview">
        <div className="section-header">
          <span className="section-eyebrow">DASHBOARD SHOWCASE</span>
          <h2 className="section-title">Preview the LabelLens Dashboard</h2>
          <p className="section-subtitle">
            Experience the redesigned scan results interface: clean, structured, and easy to read.
          </p>
        </div>

        <div className="dashboard-preview-window">
          {/* Mock Browser Header */}
          <div className="preview-window-topbar">
            <div className="window-dots">
              <span className="window-dot red"></span>
              <span className="window-dot yellow"></span>
              <span className="window-dot green"></span>
            </div>
            <div className="window-address-bar">
              <span className="lock-icon">🔒</span>
              <span>unpack.app/scan/dashboard</span>
            </div>
            <div className="window-clarity-tag">
              <span className="clarity-status-pill">CLEAR — Clarity: 94/100</span>
            </div>
          </div>

          {/* Dashboard Two-Column Layout */}
          <div className="preview-dashboard-body">
            {/* Left 40%: Scanned Label Image Mockup */}
            <div className="preview-image-panel">
              <div className="preview-image-box">
                <div className="mock-label-visual">
                  <div className="mock-label-title">OAT & NUT GRANOLA</div>
                  <div className="mock-label-meta">Batch #4028 • Net Wt 250g</div>
                  <div className="mock-label-section">
                    <strong>INGREDIENTS:</strong> Rolled oats (60%), Almonds (12%), Peanuts (8%), Honey, Sea salt, Cinnamon.
                  </div>
                  <div className="mock-label-section">
                    <strong>CONTAINS:</strong> Peanuts, Almonds (Tree Nuts).
                  </div>
                  <div className="mock-label-section">
                    <strong>MAY CONTAIN:</strong> Milk, Sesame.
                  </div>
                </div>
              </div>
            </div>

            {/* Right 60%: Structured Results Panel */}
            <div className="preview-results-panel">
              {/* Allergen Conflict Alert Banner */}
              <div className="preview-alert-banner alert-warning">
                <div className="alert-banner-header">
                  <span className="alert-icon">⚠️</span>
                  <div>
                    <strong>Allergen Match Detected: Peanuts</strong>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                      Found explicit match in verbatim text: "Peanuts (8%)"
                    </p>
                  </div>
                </div>
              </div>

              {/* Nutrition Facts Table Preview */}
              <div className="preview-table-box">
                <div className="table-box-header">
                  <strong>Nutrition Facts</strong>
                  <span className="basis-badge">Per 100g basis</span>
                </div>
                <table className="preview-mini-table">
                  <thead>
                    <tr>
                      <th>Nutrient</th>
                      <th>Value</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Energy</td>
                      <td><strong>465 kcal</strong></td>
                      <td>23% Daily Value</td>
                    </tr>
                    <tr>
                      <td>Protein</td>
                      <td><strong>11.2 g</strong></td>
                      <td>22% Daily Value</td>
                    </tr>
                    <tr>
                      <td>Carbohydrates</td>
                      <td><strong>62.5 g</strong></td>
                      <td>21% Daily Value</td>
                    </tr>
                    <tr>
                      <td>Total Fat</td>
                      <td><strong>18.4 g</strong></td>
                      <td>28% Daily Value</td>
                    </tr>
                    <tr>
                      <td>Sodium</td>
                      <td><strong>140 mg</strong></td>
                      <td>6% Daily Value</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PHASE 3: About Section
          ==================================================================== */}
      <section className="about-section" id="about" aria-label="About UnPack">
        <div className="about-card">
          <div className="about-content">
            <span className="section-eyebrow">OUR MISSION</span>
            <h2 className="about-title">Why We Built UnPack</h2>
            <p className="about-body-text">
              Navigating packaged food should not require a magnifying glass or a degree in food chemistry.
              Between hidden allergen synonyms, misleading portion sizes, and confusing font choices,
              consumers often struggle to know what is genuinely inside the food they purchase.
            </p>
            <p className="about-body-text">
              UnPack was created to bridge this gap. Using computer vision and transparent deterministic
              matching, UnPack extracts the exact text from packaging and explains it in plain language—without
              inventing missing nutrition numbers or guessing clinical safety.
            </p>
            <div className="about-notice-box">
              <strong>Important Notice:</strong> UnPack is an informational label analysis tool and does not provide
              medical diagnoses or guarantee total freedom from unlisted cross-contamination. Always follow personal
              medical guidance for severe allergies.
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PHASE 3: Final Call-to-Action Banner
          ==================================================================== */}
      <section className="hero-cta-banner">
        <div className="cta-banner-content">
          <h2 className="cta-banner-title">Ready to Look Closer and Choose Smarter?</h2>
          <p className="cta-banner-desc">
            Join UnPack today. Set up your personalized dietary profile, scan labels in seconds,
            and understand what's really inside your food.
          </p>
          <div className="cta-banner-actions">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={() => onNavigate(isAuthenticated ? 'scan' : 'register')}
            >
              {isAuthenticated ? 'Go to Scanner' : 'Create Free Account'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={() => onNavigate('scan')}
            >
              Try Scanner First
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
