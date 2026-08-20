function GradCamViewer({ base64Image, stageLabel, confidence }) {
  if (!base64Image) return null;

  return (
    <div>
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
          src={`data:image/png;base64,${base64Image}`}
          alt={`Grad-CAM heatmap — classified as ${stageLabel}`}
          style={{ maxWidth: '100%', maxHeight: 340, display: 'block' }}
        />
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray)', margin: '8px 0 0' }}>
        Heatmap highlights regions the model identified as most influential
        in classifying this retina as <strong>{stageLabel}</strong> (
        {confidence}% confidence).
      </p>
    </div>
  );
}

export default GradCamViewer;