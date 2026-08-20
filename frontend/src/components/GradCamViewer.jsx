function GradCamViewer({ originalBase64, overlayBase64, stageLabel, confidence }) {
  if (!overlayBase64) return null;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: originalBase64 ? '1fr 1fr' : '1fr',
          gap: 12,
        }}
      >
        {originalBase64 && (
          <figure style={{ margin: 0 }}>
            <div
              style={{
                border: '1px solid var(--gray-light)',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                background: 'var(--navy)',
              }}
            >
              <img
                src={`data:image/png;base64,${originalBase64}`}
                alt="Original retinal fundus image"
                style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }}
              />
            </div>
            <figcaption
              style={{
                fontSize: 11.5,
                color: 'var(--gray)',
                textAlign: 'center',
                marginTop: 6,
                fontWeight: 600,
              }}
            >
              Original image
            </figcaption>
          </figure>
        )}

        <figure style={{ margin: 0 }}>
          <div
            style={{
              border: '1px solid var(--gray-light)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              background: 'var(--navy)',
            }}
          >
            <img
              src={`data:image/png;base64,${overlayBase64}`}
              alt={`Grad-CAM heatmap — classified as ${stageLabel}`}
              style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }}
            />
          </div>
          <figcaption
            style={{
              fontSize: 11.5,
              color: 'var(--gray)',
              textAlign: 'center',
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Grad-CAM heatmap
          </figcaption>
        </figure>
      </div>

      <p style={{ fontSize: 12, color: 'var(--gray)', margin: '10px 0 0' }}>
        The heatmap highlights regions the model identified as most
        influential in classifying this retina as{' '}
        <strong>{stageLabel}</strong> ({confidence}% confidence). Warmer
        colours (red/orange) indicate stronger influence on the prediction;
        cooler colours (blue/purple) indicate lower influence.
      </p>
    </div>
  );
}

export default GradCamViewer;