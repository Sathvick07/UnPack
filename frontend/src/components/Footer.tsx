import React from 'react';
import { AppPage } from '../types/navigation';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="footer-section">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">
              <span className="footer-logo">Unpack</span>
              <span className="footer-tagline">Know What's Inside.</span>
            </div>
            <p className="footer-desc">
              Empowering consumers to read food labels with evidence-backed ingredient verification,
              allergy conflict checking, and transparent portion-based nutrition tracking.
            </p>
          </div>

          <div className="footer-nav-col">
            <h4 className="footer-heading">Navigation</h4>
            <ul className="footer-links">
              <li>
                <button type="button" onClick={() => onNavigate('home')} className="footer-link">
                  Home
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('scan')} className="footer-link">
                  Scan a Label
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('nutrition')} className="footer-link">
                  Nutrition Tracking
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-disclaimer-col">
            <h4 className="footer-heading">Transparency & Safety</h4>
            <p className="footer-disclaimer">
              Unpack provides evidence-referenced analysis of packaged food labels. Unpack does not
              diagnose conditions, provide medical advice, or guarantee that an unlisted allergen is
              absent. Always check the physical packaging in case of severe medical allergies.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Unpack — Know What's Inside.</p>
          <div className="footer-badges">
            <span className="badge-outline">Django REST Framework</span>
            <span className="badge-outline">React + TypeScript</span>
            <span className="badge-outline">Capacitor Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
