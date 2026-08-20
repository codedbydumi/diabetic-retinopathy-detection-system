function DisclaimerBanner() {
  return (
    <div className="disclaimer-banner" role="note">
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
        This system is a clinical decision-support tool and is not a
        diagnostic device. All predictions must be reviewed and confirmed by
        a qualified clinician before any clinical decision is made.
      </p>
    </div>
  );
}

export default DisclaimerBanner;