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

  // Prefer the fused score for Mode 3; fall back to the single-modality
  // score otherwise. Mirrors the same precedence used server-side in
  // GET /report/{report_id} (main.py).
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
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="section-title" style={{ marginBottom: 4 }}>
              {result.mode}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray)' }}>
              Screening result
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            New screening
          </button>
        </div>

        {riskScore !== null && (
          <div style={{ marginTop: 20 }}>
            <RiskGauge score={riskScore} level={riskLevel} />
          </div>
        )}

        {hasImage && (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p className="section-title">Predicted stage</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>
                {result.image.stage_label}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray)' }}>
                Stage {result.image.predicted_stage} · {result.image.confidence}% confidence
              </p>
            </div>
            {hasClinical && (
              <div>
                <p className="section-title">Clinical risk</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>
                  {result.clinical.risk_prediction}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray)' }}>
                  {result.clinical.risk_score}% risk score
                </p>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
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
                Preparing report…
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
      </div>

      {hasImage && result.image.gradcam_image_base64 && (
        <div className="card">
          <p className="section-title">Retinal image analysis — Grad-CAM</p>
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
          <p className="section-title">Clinical risk explanation — SHAP</p>
          <ShapChart
            shapValues={result.clinical.shap_values}
            featureNames={result.clinical.feature_names}
          />
        </div>
      )}
    </div>
  );
}

export default ResultsPanel;