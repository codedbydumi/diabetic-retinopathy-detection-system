import { useState } from 'react';
import RiskGauge from './RiskGauge';
import ShapChart from './ShapChart';
import GradCamViewer from './GradCamViewer';
import { downloadReport } from '../api';

function ResultsPanel({ result, onReset }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const hasClinical = !!result.clinical;
  const hasImage = !!result.image;

  const riskScore = result.fused_risk_score ?? result.clinical?.risk_score ?? null;

  const riskLevel =
    riskScore === null
      ? null
      : riskScore < 30
      ? 'LOW RISK'
      : riskScore < 60
      ? 'MODERATE RISK'
      : 'HIGH RISK';

  async function handleDownload() {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadReport(result.report_id);
    } catch (err) {
      setDownloadError(err.message || 'Could not download the report.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="results-layout">
      {/* ── Summary rail — pinned readout, always visible ── */}
      <div className="results-summary">
        <div className="card">
          <div className="results-summary-header">
            <p className="section-title" style={{ marginBottom: 4 }}>
              {result.mode}
            </p>
            <p className="results-summary-sub">Screening result</p>
          </div>

          {riskScore !== null && (
            <div style={{ marginTop: 16 }}>
              <RiskGauge score={riskScore} level={riskLevel} />
            </div>
          )}

          {hasImage && (
            <div className="results-readout-block">
              <span className="results-readout-label">Predicted stage</span>
              <span className="readout results-readout-value">
                {result.image.stage_label}
              </span>
              <span className="results-readout-detail">
                Stage {result.image.predicted_stage} &middot;{' '}
                <span className="readout">{result.image.confidence}%</span> confidence
              </span>
            </div>
          )}

          {hasClinical && (
            <div className="results-readout-block">
              <span className="results-readout-label">Clinical risk</span>
              <span className="readout results-readout-value">
                {result.clinical.risk_prediction}
              </span>
              <span className="results-readout-detail">
                <span className="readout">{result.clinical.risk_score}%</span> risk score
              </span>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-download"
              style={{ width: '100%' }}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Preparing report&hellip;
                </>
              ) : (
                'Download PDF report'
              )}
            </button>
            {downloadError && (
              <p className="field-error" style={{ marginTop: 8 }}>
                {downloadError}
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={onReset}
          >
            New screening
          </button>
        </div>
      </div>

      {/* ── Detail panels ── */}
      <div className="results-detail">
        {hasImage && result.image.gradcam_image_base64 && (
          <div className="card">
            <p className="section-title">Retinal image analysis &mdash; Grad-CAM</p>
            <GradCamViewer
              originalBase64={result.image.original_image_base64}
              overlayBase64={result.image.gradcam_image_base64}
              stageLabel={result.image.stage_label}
              confidence={result.image.confidence}
            />
          </div>
        )}

        {hasClinical && (
          <div className="card">
            <p className="section-title">Clinical risk explanation &mdash; SHAP</p>
            <ShapChart
              shapValues={result.clinical.shap_values}
              featureNames={result.clinical.feature_names}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsPanel;