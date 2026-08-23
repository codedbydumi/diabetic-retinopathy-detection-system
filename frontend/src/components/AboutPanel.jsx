import ClinicianScanIllustration from './ClinicianScanIllustration';

const RECOMMENDATIONS = [
  'Keep blood glucose (HbA1c) well controlled — the single strongest protective factor',
  'Get a comprehensive dilated eye exam at least once a year, or as often as your doctor recommends',
  'Manage blood pressure and cholesterol alongside blood sugar',
  'Stay physically active and maintain a balanced diet',
  'Avoid smoking',
  'Report any vision changes promptly, even if mild — early stages often have no symptoms',
];

const LEARN_MORE_LINKS = [
  {
    name: 'National Eye Institute (NIH)',
    desc: 'What diabetic retinopathy is, symptoms, and treatment',
    url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/diabetic-retinopathy',
  },
  {
    name: 'MedlinePlus (NIH)',
    desc: 'Patient-facing guide to diabetic eye disease',
    url: 'https://medlineplus.gov/diabeticeyeproblems.html',
  },
];

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

      <ClinicianScanIllustration variant="about" />

      {/* ── Diabetes & DR facts ───────────────────────────────── */}
      <p className="section-title" style={{ marginTop: 24 }}>
        Diabetes &amp; retinopathy &mdash; the numbers
      </p>
      <ul className="about-facts-list">
        <li>
          An estimated <span className="readout">537 million</span>{' '}
          adults live with diabetes worldwide, projected to reach{' '}
          <span className="readout">783 million</span> by 2045
        </li>
        <li>
          Roughly <span className="readout">1 in 3</span> people with
          diabetes develops some degree of diabetic retinopathy over
          their lifetime
        </li>
        <li>
          Risk rises with how long someone has had diabetes, not age
          alone &mdash; lifetime risk is estimated at{' '}
          <span className="readout">50&ndash;60%</span> for type 2
          diabetes and over <span className="readout">90%</span> for
          type 1 diabetes
        </li>
        <li>
          Early detection and timely treatment can lower the risk of
          blindness by up to <span className="readout">95%</span>
        </li>
      </ul>

      {/* ── What you can do ───────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: 20 }}>
        If you have diabetes, what you can do
      </p>
      <ul className="about-recommendations-list">
        {RECOMMENDATIONS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      {/* ── Learn more ─────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: 20 }}>
        Learn more
      </p>
      <div className="about-links-list">
        {LEARN_MORE_LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="about-link-item"
          >
            <span className="about-link-name">{link.name}</span>
            <span className="about-link-desc">{link.desc}</span>
          </a>
        ))}
      </div>
      <p className="about-text-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
        These are independent, authoritative medical resources &mdash;
        not part of this system &mdash; provided for further reading.
      </p>

      <div className="about-panel-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Back to screening
        </button>
      </div>
    </div>
  );
}

export default AboutPanel;