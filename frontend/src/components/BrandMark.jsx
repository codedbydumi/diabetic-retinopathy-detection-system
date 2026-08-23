// Custom brand mark for the DR Detection System — a minimalist retinal
// scan reticle (eye outline + crosshair scan ticks), directly evoking
// the system's core function (retinal imaging + AI scanning) rather
// than a generic medical cross or stock icon.
function BrandMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.2" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <line x1="12" y1="1.6" x2="12" y2="4.3" />
      <line x1="12" y1="19.7" x2="12" y2="22.4" />
      <line x1="1.6" y1="12" x2="4.3" y2="12" />
      <line x1="19.7" y1="12" x2="22.4" y2="12" />
    </svg>
  );
}

export default BrandMark;