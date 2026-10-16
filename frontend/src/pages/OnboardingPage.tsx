import React, { useState } from 'react';
import { AppPage } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../api/client';
import { AllergyStatus } from '../types/auth';
import { UnpackLogo } from '../components/UnpackLogo';

interface OnboardingPageProps {
  onNavigate: (page: AppPage) => void;
}

const COMMON_ALLERGENS = [
  { id: 'peanut', label: 'Peanuts', icon: '🥜' },
  { id: 'tree_nut', label: 'Tree Nuts (Almonds, Walnuts, Cashews)', icon: '🌰' },
  { id: 'milk', label: 'Dairy / Milk (Lactose)', icon: '🥛' },
  { id: 'gluten', label: 'Gluten / Wheat', icon: '🌾' },
  { id: 'egg', label: 'Eggs', icon: '🥚' },
  { id: 'soy', label: 'Soy / Soybeans', icon: '🌱' },
  { id: 'shellfish', label: 'Shellfish (Crab, Shrimp, Lobster)', icon: '🦐' },
  { id: 'fish', label: 'Fish', icon: '🐟' },
  { id: 'sesame', label: 'Sesame', icon: '🌿' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten_free', label: 'Gluten-Free Diet' },
  { id: 'keto', label: 'Ketogenic / Low-Carb' },
  { id: 'low_sodium', label: 'Low Sodium' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
];

const HEALTH_CONDITIONS = [
  { id: 'diabetic', label: 'Diabetic Friendly (Low Sugar)' },
  { id: 'hypertension', label: 'Hypertension (Low Sodium)' },
  { id: 'celiac', label: 'Celiac Disease' },
  { id: 'cardiac', label: 'Heart Healthy (Low Saturated Fat)' },
];

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { user, token, updateUserContext } = useAuth();

  const [step, setStep] = useState<number>(1);
  const totalSteps = 3;

  // Step 1: Basic Profile
  const [ageRange, setAgeRange] = useState<string>(user?.profile?.age_range || '');
  const [heightCm, setHeightCm] = useState<string>(user?.profile?.height_cm ? String(user?.profile?.height_cm) : '');
  const [weightKg, setWeightKg] = useState<string>(user?.profile?.weight_kg ? String(user?.profile?.weight_kg) : '');

  // Step 2: Allergies & Intolerances
  const [allergyStatus, setAllergyStatus] = useState<AllergyStatus>(user?.profile?.allergy_status || 'specified');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(user?.profile?.allergies || ['peanut', 'tree_nut']);
  const [customAllergyInput, setCustomAllergyInput] = useState('');

  // Step 3: Dietary Preferences & Health Goals
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>(user?.profile?.dietary_preferences || []);
  const [healthConditions, setHealthConditions] = useState<string[]>(user?.profile?.health_conditions || []);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleAllergy = (allergyId: string) => {
    setAllergyStatus('specified');
    if (selectedAllergies.includes(allergyId)) {
      setSelectedAllergies(selectedAllergies.filter((a) => a !== allergyId));
    } else {
      setSelectedAllergies([...selectedAllergies, allergyId]);
    }
  };

  const handleAddCustomAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customAllergyInput.trim().toLowerCase();
    if (trimmed && !selectedAllergies.includes(trimmed)) {
      setSelectedAllergies([...selectedAllergies, trimmed]);
      setAllergyStatus('specified');
      setCustomAllergyInput('');
    }
  };

  const removeAllergy = (id: string) => {
    setSelectedAllergies(selectedAllergies.filter((a) => a !== id));
  };

  const toggleDietaryPref = (id: string) => {
    if (dietaryPrefs.includes(id)) {
      setDietaryPrefs(dietaryPrefs.filter((p) => p !== id));
    } else {
      setDietaryPrefs([...dietaryPrefs, id]);
    }
  };

  const toggleHealthCondition = (id: string) => {
    if (healthConditions.includes(id)) {
      setHealthConditions(healthConditions.filter((c) => c !== id));
    } else {
      setHealthConditions([...healthConditions, id]);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!token) {
      onNavigate('login');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const payload = {
      age_range: ageRange,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      allergy_status: allergyStatus,
      allergies: allergyStatus === 'specified' ? selectedAllergies : [],
      dietary_preferences: dietaryPrefs,
      health_conditions: healthConditions,
      onboarding_completed: true,
    };

    try {
      const response = await updateUserProfile(token, payload);
      updateUserContext(response.profile);
      onNavigate('scan');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="onboarding-page-container">
      <div className="onboarding-card" role="region" aria-label="Personalized Profile Setup">
        {/* Header */}
        <div className="onboarding-header">
          <UnpackLogo size="md" showTagline={false} onClick={() => onNavigate('home')} />
          <h1 className="onboarding-title">Personalize Your LabelLens Scanner</h1>
          <p className="onboarding-subtitle">
            Tell us about your dietary restrictions so UnPack can automatically flag allergens
            that matter to you.
          </p>

          {/* Progress Indicator */}
          <div className="onboarding-progress-bar" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
            <div className="progress-steps-indicator">
              <div className={`progress-step-pill ${step >= 1 ? 'completed' : ''}`}>
                <span className="step-badge">{step > 1 ? '✓' : '1'}</span>
                <span className="step-label">Basic Profile</span>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step-pill ${step >= 2 ? 'completed' : ''}`}>
                <span className="step-badge">{step > 2 ? '✓' : '2'}</span>
                <span className="step-label">Allergies</span>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step-pill ${step >= 3 ? 'completed' : ''}`}>
                <span className="step-badge">{step >= 3 ? '3' : '3'}</span>
                <span className="step-label">Diet & Health</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {saveError && (
          <div className="auth-error-banner" role="alert">
            <span>{saveError}</span>
          </div>
        )}

        {/* STEP 1: Basic Profile */}
        {step === 1 && (
          <div className="onboarding-step-pane">
            <div className="step-pane-header">
              <h2 className="step-pane-title">Step 1: Basic Profile Details</h2>
              <p className="step-pane-subtitle">
                This helps us estimate recommended dietary allowances. Height and weight are
                completely optional.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="age-range-select" className="form-label">
                Age or Age Range
              </label>
              <select
                id="age-range-select"
                className="form-input form-select"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
              >
                <option value="">Select age range (optional)</option>
                <option value="under_18">Under 18 years</option>
                <option value="18-24">18–24 years</option>
                <option value="25-34">25–34 years</option>
                <option value="35-49">35–49 years</option>
                <option value="50-64">50–64 years</option>
                <option value="65_plus">65 years and older</option>
              </select>
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label htmlFor="height-input" className="form-label">
                  Height (cm) <span className="optional-tag">Optional</span>
                </label>
                <input
                  id="height-input"
                  type="number"
                  min="50"
                  max="250"
                  className="form-input"
                  placeholder="e.g. 175"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="weight-input" className="form-label">
                  Weight (kg) <span className="optional-tag">Optional</span>
                </label>
                <input
                  id="weight-input"
                  type="number"
                  min="20"
                  max="300"
                  className="form-input"
                  placeholder="e.g. 70"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
            </div>

            <div className="step-action-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(2)}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(2)}
              >
                Next: Allergies →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Allergies & Intolerances */}
        {step === 2 && (
          <div className="onboarding-step-pane">
            <div className="step-pane-header">
              <h2 className="step-pane-title">Step 2: Food Allergies & Intolerances</h2>
              <p className="step-pane-subtitle">
                Select known allergies. UnPack flags any ingredient or statement matching these
                items with verbatim evidence from the package.
              </p>
            </div>

            {/* Quick Status Toggles */}
            <div className="allergy-status-selector">
              <button
                type="button"
                className={`status-choice-btn ${allergyStatus === 'none' ? 'active' : ''}`}
                onClick={() => {
                  setAllergyStatus('none');
                  setSelectedAllergies([]);
                }}
              >
                <span className="choice-dot"></span>
                <span>No known allergies reported</span>
              </button>
              <button
                type="button"
                className={`status-choice-btn ${allergyStatus === 'uncertain' ? 'active' : ''}`}
                onClick={() => {
                  setAllergyStatus('uncertain');
                }}
              >
                <span className="choice-dot"></span>
                <span>Uncertain allergy information</span>
              </button>
              <button
                type="button"
                className={`status-choice-btn ${allergyStatus === 'unanswered' ? 'active' : ''}`}
                onClick={() => {
                  setAllergyStatus('unanswered');
                  setSelectedAllergies([]);
                }}
              >
                <span className="choice-dot"></span>
                <span>Prefer not to answer</span>
              </button>
            </div>

            {/* Common Allergens Grid */}
            <div className="allergens-selection-section">
              <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                Select Specific Allergies to Track:
              </label>

              <div className="allergens-chips-grid">
                {COMMON_ALLERGENS.map((item) => {
                  const isSelected = selectedAllergies.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`allergen-toggle-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleAllergy(item.id)}
                      aria-pressed={isSelected}
                    >
                      <span className="chip-icon">{item.icon}</span>
                      <span className="chip-name">{item.label}</span>
                      <span className="chip-check">{isSelected ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Allergy Input */}
              <div className="custom-allergy-bar">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add custom allergy (e.g. mustard, celery, lupin)..."
                  value={customAllergyInput}
                  onChange={(e) => setCustomAllergyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomAllergy(e);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddCustomAllergy}
                >
                  Add Custom
                </button>
              </div>

              {/* Active Selected Allergens Tag Cloud */}
              {selectedAllergies.length > 0 && (
                <div className="active-allergies-cloud">
                  <span className="cloud-label">Active allergy restrictions:</span>
                  <div className="cloud-chips">
                    {selectedAllergies.map((allg) => (
                      <span key={allg} className="active-allergy-badge">
                        <span>{allg}</span>
                        <button
                          type="button"
                          className="badge-remove-btn"
                          onClick={() => removeAllergy(allg)}
                          title={`Remove ${allg}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="step-action-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(1)}
              >
                ← Back to Profile
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
              >
                Next: Diet & Goals →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Dietary Preferences & Health Goals */}
        {step === 3 && (
          <div className="onboarding-step-pane">
            <div className="step-pane-header">
              <h2 className="step-pane-title">Step 3: Dietary Preferences & Health Goals</h2>
              <p className="step-pane-subtitle">
                Select any lifestyle diets or nutritional goals you want UnPack to keep in mind.
              </p>
            </div>

            {/* Dietary Preferences */}
            <div className="form-group">
              <label className="form-label">Dietary Preferences (Optional):</label>
              <div className="preferences-chips-grid">
                {DIETARY_OPTIONS.map((item) => {
                  const isChecked = dietaryPrefs.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`preference-toggle-chip ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleDietaryPref(item.id)}
                      aria-pressed={isChecked}
                    >
                      <span>{item.label}</span>
                      <span className="pref-check">{isChecked ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Health Conditions */}
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label className="form-label">Relevant Health Conditions (Optional):</label>
              <div className="preferences-chips-grid">
                {HEALTH_CONDITIONS.map((item) => {
                  const isChecked = healthConditions.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`preference-toggle-chip ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleHealthCondition(item.id)}
                      aria-pressed={isChecked}
                    >
                      <span>{item.label}</span>
                      <span className="pref-check">{isChecked ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Purpose & Privacy Notice */}
            <div className="onboarding-purpose-callout">
              <div className="callout-icon">💡</div>
              <div className="callout-text">
                <strong>Why we collect this:</strong>
                <span>
                  Your answers are stored securely in your private profile and used exclusively
                  to highlight safety considerations when you scan food labels. We never sell your data
                  or provide medical diagnoses.
                </span>
              </div>
            </div>

            <div className="step-action-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(2)}
                disabled={isSaving}
              >
                ← Back to Allergies
              </button>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleCompleteOnboarding}
                disabled={isSaving}
              >
                {isSaving ? 'Saving profile...' : 'Complete & Open Scanner →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
