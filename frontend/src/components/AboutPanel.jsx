function AboutPanel({ onClose }) {
  return (
    <div className="about-panel">
      <div className="about-panel-header">
        <p className="section-title" style={{ margin: 0 }}>
          About this system
        </p>
        <button
          type="button"
          className="about-panel-close"
          onClick={onClose}
          aria-label="Close about section"
        >
          ×
        </button>
      </div>

      <p className="about-text">
        This is a multi-modal AI screening system for diabetic
        retinopathy (DR) — a leading cause of preventable blindness in
        adults with diabetes. It combines a clinical risk model with a
        retinal image classifier, so screening can happen with either
        input alone or both together, depending on what a clinic has
        available.
      </p>

      <div className="about-modes">
        <div className="about-mode">
          <span className="about-mode-label">Mode 1</span>
          <span className="about-mode-desc">
            Clinical parameters only — no retinal image needed
          </span>
        </div>
        <div className="about-mode">
          <span className="about-mode-label">Mode 2</span>
          <span className="about-mode-desc">
            Retinal image only — no clinical data needed
          </span>
        </div>
        <div className="about-mode">
          <span className="about-mode-label">Mode 3</span>
          <span className="about-mode-desc">
            Both combined — highest-confidence result
          </span>
        </div>
      </div>

      <p className="about-text">
        The clinical model is a gradient-boosted classifier (XGBoost)
        trained on verified clinical datasets, explained per patient
        with SHAP. The image model is a MobileNetV2 convolutional
        network fine-tuned to grade DR severity across five stages
        (No DR to Proliferative DR), explained with Grad-CAM heatmaps
        showing which regions of the retina influenced the result.
      </p>

      <p className="about-text about-text-muted">
        This is a decision-support tool developed as part of an
        academic research project. It is not a diagnostic device, and
        every prediction is intended for review by a qualified
        clinician.
      </p>
    </div>
  );
}

export default AboutPanel;