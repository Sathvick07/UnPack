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
              <li>
                <a
                  href="https://github.com/Sathvick07/UnPack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-github-link"
                  aria-label="View UnPack project repository on GitHub (opens in a new tab)"
                >
                  <svg className="github-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>View on GitHub</span>
                </a>
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
            <a
              href="https://github.com/Sathvick07/UnPack"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-repo-pill"
              aria-label="View UnPack source code on GitHub (opens in a new tab)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub Repository</span>
            </a>
            <span className="badge-outline">Deterministic OCR</span>
            <span className="badge-outline">Zero Hallucinations</span>
            <span className="badge-outline">Allergen Safety</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
