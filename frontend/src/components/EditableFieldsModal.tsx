import React, { useState } from 'react';
import { ExtractedIngredient, NutritionFact } from '../types/label';

interface EditableFieldsModalProps {
  initialIngredients: ExtractedIngredient[];
  initialNutrition: Record<string, NutritionFact>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    updatedIngredients: ExtractedIngredient[],
    updatedNutrition: Record<string, NutritionFact>
  ) => void;
}

export const EditableFieldsModal: React.FC<EditableFieldsModalProps> = ({
  initialIngredients,
  initialNutrition,
  isOpen,
  onClose,
  onSave,
}) => {
  const [ingredients, setIngredients] = useState<ExtractedIngredient[]>([...initialIngredients]);
  const [nutrition, setNutrition] = useState<Record<string, NutritionFact>>({ ...initialNutrition });
  const [newIngredient, setNewIngredient] = useState('');

  if (!isOpen) return null;

  const handleIngredientChange = (index: number, val: string) => {
    const next = [...ingredients];
    next[index] = { ...next[index], name: val, source_text: val };
    setIngredients(next);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAddIngredient = () => {
    if (!newIngredient.trim()) return;
    setIngredients([
      ...ingredients,
      {
        name: newIngredient.trim(),
        source_text: newIngredient.trim(),
        status: 'detected',
        confidence: 1.0,
        notes: 'Manually added by user',
      },
    ]);
    setNewIngredient('');
  };

  const handleNutritionChange = (key: string, valStr: string) => {
    const num = valStr === '' ? null : parseFloat(valStr);
    const existing = nutrition[key] || {
      nutrient: key,
      value: null,
      unit: key === 'energy' ? 'kcal' : 'g',
      basis: 'per_100g',
      status: 'detected',
      source_text: '',
    };
    setNutrition({
      ...nutrition,
      [key]: {
        ...existing,
        value: isNaN(num as number) ? null : num,
        status: num !== null ? 'detected' : 'not_provided',
        source_text: num !== null ? `User confirmed: ${num} ${existing.unit}` : '',
      },
    });
  };

  const handleNutritionServingChange = (key: string, valStr: string) => {
    const num = valStr === '' ? null : parseFloat(valStr);
    const existing = nutrition[key] || {
      nutrient: key,
      value: null,
      unit: key === 'energy' ? 'kcal' : (key === 'sodium' ? 'mg' : 'g'),
      basis: 'per_100g',
      status: 'detected',
      source_text: '',
    };
    setNutrition({
      ...nutrition,
      [key]: {
        ...existing,
        serving_value: isNaN(num as number) ? null : num,
        serving_basis: num !== null ? 'per_serving' : '',
      },
    });
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = () => {
    onSave(ingredients, nutrition);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editable-fields-modal-title"
      >
        <div className="modal-header">
          <h3 id="editable-fields-modal-title" className="modal-title">Edit & Correct Extracted Label Data</h3>
          <button
            type="button"
            className="btn-modal-close modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Correct OCR typos, fix unclear words, or input values not cleanly recognized from the
            label photo. Findings will re-evaluate automatically.
          </p>

          <section className="modal-section">
            <h4 className="modal-section-title">Extracted Ingredients ({ingredients.length})</h4>
            <div className="ingredients-edit-list">
              {ingredients.map((ing, i) => (
                <div key={i} className="ingredient-edit-row">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => handleIngredientChange(i, e.target.value)}
                    className="input-field"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => handleRemoveIngredient(i)}
                    title="Remove item"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>

            <div className="add-ingredient-box">
              <input
                type="text"
                placeholder="Add missing ingredient..."
                value={newIngredient}
                onChange={(e) => setNewIngredient(e.target.value)}
                className="input-field"
                onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleAddIngredient}
              >
                + Add
              </button>
            </div>
          </section>

          <section className="modal-section">
            <h4 className="modal-section-title">Nutrition Facts (Per 100g and Per Serving)</h4>
            <div className="nutrition-edit-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['energy', 'fat', 'saturated_fat', 'trans_fat', 'carbohydrates', 'sugars', 'added_sugars', 'protein', 'sodium'].map((key) => {
                const fact = nutrition[key];
                const unit = fact?.unit || (key === 'energy' ? 'kcal' : (key === 'sodium' ? 'mg' : 'g'));
                return (
                  <div key={key} className="nutrition-edit-field-row">
                    <span className="nutrient-edit-label">
                      {key.replace('_', ' ').toUpperCase()} ({unit})
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="Per 100g (optional)"
                      value={fact?.value !== null && fact?.value !== undefined ? fact.value : ''}
                      onChange={(e) => handleNutritionChange(key, e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Per Serving (optional)"
                      value={fact?.serving_value !== null && fact?.serving_value !== undefined ? fact.serving_value : ''}
                      onChange={(e) => handleNutritionServingChange(key, e.target.value)}
                      className="input-field"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Apply Changes & Re-evaluate
          </button>
        </div>
      </div>
    </div>
  );
};
