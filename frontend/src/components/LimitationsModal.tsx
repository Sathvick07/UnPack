import React from 'react';

interface LimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LimitationsModal: React.FC<LimitationsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">System Capabilities & Limitations</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="limitation-block">
            <h4>1. Observable Physical Evidence Only</h4>
            <p>
              Unpack extracts solely what is visible on the uploaded packaging photograph. If an ingredient
              list is cut off, wrapped around a curved can, or hidden behind a fold, the system marks the
              missing section as <strong>unreadable</strong> or <strong>unknown</strong>.
            </p>
          </div>

          <div className="limitation-block">
            <h4>2. Absence ≠ Allergen-Free Guarantee</h4>
            <p>
              When no allergen is identified in the readable portion of a label, Unpack reports
              <em>"No conflict identified in readable information"</em>. This does <strong>not</strong>
              guarantee that the product is medically allergen-free, as unlisted shared-facility cross-contact
              may occur.
            </p>
          </div>

          <div className="limitation-block">
            <h4>3. Missing Facts Are Never Inferred as Zero</h4>
            <p>
              If a manufacturer does not report a nutrient (e.g. trans fat, added sugars, or potassium),
              Unpack explicitly flags it as <em>Not Provided</em> rather than treating it as 0.0g.
            </p>
          </div>

          <div className="limitation-block">
            <h4>4. Non-Medical Advice</h4>
            <p>
              Unpack is an evidence-referenced consumer tool and does not provide clinical diagnosis,
              disease prediction, or certified medical advice.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
