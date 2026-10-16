import React from 'react';
import { AppPage } from '../types/navigation';
import { UnpackLogo } from './UnpackLogo';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="footer-section">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <UnpackLogo size="md" showTagline={true} onClick={() => onNavigate('home')} />
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
                <button type="button" onClick={() => onNavigate('register')} className="footer-link">
                  Create Account
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('login')} className="footer-link">
                  Sign In
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-disclaimer-col">
            <h4 className="footer-heading">Transparency & Medical Notice</h4>
            <p className="footer-disclaimer">
              UnPack is an informational label analysis tool designed to help consumers read and understand packaged-food
              labels. UnPack does not provide medical advice, diagnose health conditions, or guarantee that unlisted
              allergens are absent. Always consult a healthcare professional for clinical dietary decisions.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} UnPack — Know What's Inside. All rights reserved.</p>
          <div className="footer-badges">
            <span className="badge-outline">Deterministic OCR</span>
            <span className="badge-outline">Zero Hallucinations</span>
            <span className="badge-outline">Allergen Safety</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
