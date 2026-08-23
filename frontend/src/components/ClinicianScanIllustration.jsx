// A deliberately schematic, flat illustration — not a realistic drawing —
// showing a monitor with a pulsing/scanning retinal reticle beside a
// simple clinician pictogram. Reinforces the human-in-the-loop message
// (AI scans, clinician reviews) rather than existing as pure decoration.
//
// variant="welcome" — the simpler version shown in the welcome gate.
// variant="about"   — adds small floating "data point" markers to feel
//                      more active/analytical, appropriate to a page
//                      the user reads more deliberately.
function ClinicianScanIllustration({ caption = true, variant = 'welcome' }) {
  const isAbout = variant === 'about';

  return (
    <div className={`scan-illustration-wrap${isAbout ? ' scan-illustration-about' : ''}`}>
      <svg
        viewBox="0 0 320 170"
        width="100%"
        style={{ maxWidth: isAbout ? 340 : 320, display: 'block', margin: '0 auto' }}
        role="img"
        aria-label="Illustration of a clinician reviewing an AI-generated retinal scan"
      >
        {/* monitor */}
        <rect x="88" y="12" width="146" height="98" rx="10" fill="none" stroke="var(--navy)" strokeWidth="1.6" />
        <rect x="150" y="112" width="22" height="12" fill="var(--navy)" opacity="0.5" />
        <rect x="134" y="124" width="54" height="6" rx="3" fill="var(--navy)" opacity="0.5" />

        {/* pulse rings around the retina reticle */}
        <circle className="scan-pulse-ring scan-pulse-1" cx="161" cy="61" r="24" fill="none" stroke="var(--teal)" strokeWidth="1.2" />
        <circle className="scan-pulse-ring scan-pulse-2" cx="161" cy="61" r="24" fill="none" stroke="var(--teal)" strokeWidth="1.2" />

        {/* retina reticle (same motif as the brand mark) */}
        <circle cx="161" cy="61" r="20" fill="none" stroke="var(--navy)" strokeWidth="1.6" />
        <circle cx="161" cy="61" r="5.5" fill="var(--teal)" />
        <line x1="161" y1="33" x2="161" y2="41" stroke="var(--navy)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="161" y1="81" x2="161" y2="89" stroke="var(--navy)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="133" y1="61" x2="141" y2="61" stroke="var(--navy)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="181" y1="61" x2="189" y2="61" stroke="var(--navy)" strokeWidth="1.4" strokeLinecap="round" />

        {/* sweeping scan line, clipped to the monitor interior */}
        <clipPath id={`scanClip-${variant}`}>
          <rect x="90" y="14" width="142" height="94" rx="9" />
        </clipPath>
        <g clipPath={`url(#scanClip-${variant})`}>
          <line
            className="scan-sweep-line"
            x1="90"
            y1="61"
            x2="232"
            y2="61"
            stroke="var(--teal)"
            strokeWidth="2"
          />
        </g>

        {/* clinician pictogram */}
        <circle cx="42" cy="96" r="14" fill="none" stroke="var(--navy)" strokeWidth="1.6" />
        <rect x="24" y="116" width="36" height="46" rx="15" fill="none" stroke="var(--navy)" strokeWidth="1.6" />
        <rect x="50" y="128" width="15" height="19" rx="2" fill="none" stroke="var(--gray)" strokeWidth="1.2" />
        <line x1="53" y1="133" x2="62" y2="133" stroke="var(--gray)" strokeWidth="1" />
        <line x1="53" y1="138" x2="62" y2="138" stroke="var(--gray)" strokeWidth="1" />

        {/* about-page only: floating data-point markers, suggesting
            active analysis rather than a static illustration */}
        {isAbout && (
          <>
            <circle className="scan-data-dot scan-data-dot-1" cx="252" cy="30" r="3" fill="var(--teal)" />
            <circle className="scan-data-dot scan-data-dot-2" cx="264" cy="70" r="2.5" fill="var(--navy)" opacity="0.5" />
            <circle className="scan-data-dot scan-data-dot-3" cx="246" cy="95" r="2" fill="var(--teal)" opacity="0.7" />
          </>
        )}
      </svg>
      {caption && (
        <p className="scan-illustration-caption">
          AI-assisted analysis &mdash; every result is reviewed by a
          qualified clinician
        </p>
      )}
    </div>
  );
}

export default ClinicianScanIllustration;