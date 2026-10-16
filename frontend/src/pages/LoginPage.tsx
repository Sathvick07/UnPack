import React, { useState } from 'react';
import { AppPage } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/client';
import { UnpackLogo } from '../components/UnpackLogo';

interface LoginPageProps {
  onNavigate: (page: AppPage) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await loginUser({
        email: email.trim(),
        password,
      });

      login(response.token, response.user);

      // Route based on whether onboarding is complete
      if (response.user.profile?.onboarding_completed) {
        onNavigate('scan');
      } else {
        onNavigate('onboarding');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card" role="region" aria-label="Sign In Form">
        {/* Brand Header */}
        <div className="auth-header">
          <UnpackLogo size="md" showTagline={false} onClick={() => onNavigate('home')} />
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">
            Sign in to access your saved allergens and food label analysis history.
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="btn btn-primary btn-block btn-large auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="btn-loading-content">
                <span className="spinner-dot"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer Link to Register */}
        <div className="auth-footer">
          <span>Don't have an account yet?</span>
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => onNavigate('register')}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
};
