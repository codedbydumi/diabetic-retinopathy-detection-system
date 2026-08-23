import { useState } from 'react';
import BrandMark from './BrandMark';
import ClinicianScanIllustration from './ClinicianScanIllustration';

const FEATURES = [
  {
    title: 'Multi-modal screening',
    desc: 'Use clinical data, a retinal photo, or both together',
  },
  {
    title: 'Explainable results',
    desc: 'See exactly what drove each prediction, with SHAP and Grad-CAM',
  },
  {
    title: 'Instant clinical reports',
    desc: 'Download a structured PDF report for every screening',
  },
];

function WelcomeGate({ onEnter }) {
  const [agreed, setAgreed] = useState(false);

  function handleContinue() {
    if (!agreed) return;
    onEnter();
  }

  return (
    <div className="welcome-gate">
      {/* ── LEFT — introduction / story panel ── */}
      <div className="welcome-panel welcome-panel-story">
        <div className="welcome-story-inner">
          <div className="welcome-brand">
            <span className="welcome-brand-mark">
              <BrandMark size={26} />
            </span>
            <span className="welcome-brand-name">DR Detection System</span>
          </div>

          <h1 className="welcome-title">
            Diabetic Retinopathy Detection System
          </h1>

          <p className="welcome-intro">
            An AI-assisted screening tool that helps identify diabetic
            retinopathy risk using clinical data, retinal imaging, or
            both &mdash; built to support faster, more accessible
            screening at primary care level.
          </p>

          <p className="welcome-intro">
            Every prediction comes with an explanation, not just a
            number, so a clinician can see exactly what the system
            found and why &mdash; and confirm or override it
            accordingly.
          </p>

          <div className="welcome-features">
            {FEATURES.map((f, i) => (
              <div
                className="welcome-feature"
                key={f.title}
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}
              >
                <span className="welcome-feature-title">{f.title}</span>
                <span className="welcome-feature-desc">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — action panel ── */}
      <div className="welcome-panel welcome-panel-action">
        <div className="welcome-action-inner">
          <ClinicianScanIllustration />

          <div className="welcome-disclaimer-box">
            <svg
              className="disclaimer-icon"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 6.5v4M10 13.5h.01M2.5 10a7.5 7.5 0 1015 0 7.5 7.5 0 00-15 0z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>
              This system is a clinical decision-support tool and is
              not a diagnostic device. All predictions must be
              reviewed and confirmed by a qualified clinician before
              any clinical decision is made.
            </p>
          </div>

          <p className="welcome-extra-note">
            This tool is designed to support your clinical assessment,
            not replace it. Do not use its output alone to reach a
            diagnosis or treatment decision &mdash; always base
            clinical decisions on your own judgement and established
            medical guidelines.
          </p>

          <label className="welcome-checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I understand and agree to these terms</span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!agreed}
            onClick={handleContinue}
          >
            Continue to system
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeGate;