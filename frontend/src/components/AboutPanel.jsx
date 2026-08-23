import ClinicianScanIllustration from './ClinicianScanIllustration';

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
        retinopathy (DR) &mdash; a leading cause of preventable
        blindness in adults with diabetes. It combines a clinical risk
        model with a retinal image classifier, with every prediction
        explained rather than left as a black box.
      </p>

      <p className="section-title" style={{ marginTop: 20 }}>
        Models &amp; performance
      </p>
      <div className="about-models">
        <div className="about-model-card">
          <span className="about-model-name">Clinical risk model</span>
          <span className="about-model-detail">XGBoost, trained on verified clinical datasets</span>
          <div className="about-model-stats">
            <div className="about-stat">
              <span className="about-stat-value readout">87.1%</span>
              <span className="about-stat-label">Accuracy</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value readout">0.896</span>
              <span className="about-stat-label">AUC-ROC</span>
            </div>
          </div>
        </div>

        <div className="about-model-card">
          <span className="about-model-name">Retinal image model</span>
          <span className="about-model-detail">MobileNetV2, fine-tuned across 5 DR severity stages</span>
          <div className="about-model-stats">
            <div className="about-stat">
              <span className="about-stat-value readout">78.0%</span>
              <span className="about-stat-label">Accuracy</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value readout">0.920</span>
              <span className="about-stat-label">AUC-ROC</span>
            </div>
          </div>
        </div>
      </div>

      <p className="about-text about-text-muted" style={{ marginTop: 14 }}>
        Both models are explained per prediction &mdash; SHAP for
        clinical risk factors, Grad-CAM for retinal image regions
        &mdash; and results are only ever intended to support, not
        replace, clinical judgement.
      </p>

      <ClinicianScanIllustration />
    </div>
  );
}

export default AboutPanel;