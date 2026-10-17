import React, { useState } from 'react';
import { AppPage } from '../types/navigation';
import { ConnectionState } from '../types/api';
import { StatusPill } from './StatusPill';
import { ThemeToggle } from './ThemeToggle';
import { UnpackLogo } from './UnpackLogo';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  connectionState: ConnectionState;
  latency: number | null;
  onRefreshHealth: () => void;
  onRequestLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  connectionState,
  latency,
  onRefreshHealth,
  onRequestLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const handleSectionScroll = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (currentPage !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavClick = (page: AppPage) => {
    setMobileMenuOpen(false);
    onNavigate(page);
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    if (onRequestLogout) {
      onRequestLogout();
      return;
    }
    await logout();
    onNavigate('home');
  };

  const displayName = user?.profile?.full_name?.trim() || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="navbar" role="navigation" aria-label="Main Navigation">
      <div className="navbar-container">
        {/* Left: Official UnPack Logo & Tagline */}
        <div className="navbar-left">
          <UnpackLogo
            size="md"
            showTagline={true}
            onClick={() => handleNavClick('home')}
          />
        </div>

        {/* Center: Main Navigation Links */}
        <div className="navbar-center" role="menubar">
          <div className="nav-links">
            <button
              type="button"
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => handleNavClick('home')}
              role="menuitem"
            >
              Home
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => handleSectionScroll('features')}
              role="menuitem"
            >
              Features
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => handleSectionScroll('how-it-works')}
              role="menuitem"
            >
              How It Works
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => handleSectionScroll('preview')}
              role="menuitem"
            >
              Preview
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => handleSectionScroll('about')}
              role="menuitem"
            >
              About
            </button>
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  className={`nav-link ${currentPage === 'scan' ? 'active' : ''}`}
                  onClick={() => handleNavClick('scan')}
                  role="menuitem"
                >
                  Scan Dashboard
                </button>
                <button
                  type="button"
                  className={`nav-link ${currentPage === 'nutrition' ? 'active' : ''}`}
                  onClick={() => handleNavClick('nutrition')}
                  role="menuitem"
                >
                  Daily Intake
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Theme Toggle, Connection Pill, Auth Actions */}
        <div className="navbar-right">
          <StatusPill
            state={connectionState}
            latency={latency}
            onRefresh={onRefreshHealth}
          />

          <ThemeToggle />

          <a
            href="https://github.com/Sathvick07/UnPack"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-github-link"
            title="View UnPack on GitHub"
            aria-label="View UnPack repository on GitHub (opens in a new tab)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="navbar-github-text">GitHub</span>
          </a>

          {isAuthenticated ? (
            <div className="navbar-desktop-auth" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                className="navbar-user-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flexShrink: 0,
                }}
                title={user?.email}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="navbar-user-name" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="navbar-desktop-auth" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleNavClick('login')}
              >
                Log In
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleNavClick('register')}
              >
                Get Started
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
          <a
            href="https://github.com/Sathvick07/UnPack"
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-menu-link mobile-github-link"
            aria-label="View UnPack repository on GitHub (opens in a new tab)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ marginRight: '8px' }}>
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View on GitHub
          </a>
          <button
            type="button"
            className={`mobile-menu-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            Home
          </button>
          <button
            type="button"
            className="mobile-menu-link"
            onClick={() => handleSectionScroll('features')}
          >
            Features
          </button>
          <button
            type="button"
            className="mobile-menu-link"
            onClick={() => handleSectionScroll('how-it-works')}
          >
            How It Works
          </button>
          <button
            type="button"
            className="mobile-menu-link"
            onClick={() => handleSectionScroll('preview')}
          >
            Preview
          </button>
          <button
            type="button"
            className="mobile-menu-link"
            onClick={() => handleSectionScroll('about')}
          >
            About
          </button>
          {isAuthenticated && (
            <>
              <button
                type="button"
                className={`mobile-menu-link ${currentPage === 'scan' ? 'active' : ''}`}
                onClick={() => handleNavClick('scan')}
              >
                Scan Dashboard
              </button>
              <button
                type="button"
                className={`mobile-menu-link ${currentPage === 'nutrition' ? 'active' : ''}`}
                onClick={() => handleNavClick('nutrition')}
              >
                Daily Intake
              </button>
            </>
          )}

          <div className="mobile-drawer-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Appearance</span>
              <ThemeToggle showLabel={true} />
            </div>

            {isAuthenticated ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Signed in as <strong>{displayName}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={handleLogout}
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => handleNavClick('login')}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => handleNavClick('register')}
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
