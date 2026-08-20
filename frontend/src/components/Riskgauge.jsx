function RiskGauge({ score, level }) {
  const clamped = Math.max(0, Math.min(100, score));

  const cx = 100;
  const cy = 100;
  const r = 80;

  // Needle angle: 0% -> 180deg (left), 100% -> 0deg (right) — same
  // orientation as the ReportLab gauge in main.py (build_pdf_report).
  const angleDeg = 180 - (clamped / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleLen = r - 14;
  const nx = cx + needleLen * Math.cos(angleRad);
  const ny = cy - needleLen * Math.sin(angleRad);

  const color =
    clamped < 30 ? 'var(--green)' : clamped < 60 ? 'var(--amber)' : 'var(--red)';
  const bg =
    clamped < 30 ? 'var(--green-bg)' : clamped < 60 ? 'var(--amber-bg)' : 'var(--red-bg)';
  const border =
    clamped < 30 ? '#a7f3d0' : clamped < 60 ? '#fde68a' : '#fecaca';

  // Three background zones drawn as arcs.
  function arcPath(startPct, endPct) {
    const a1 = 180 - (startPct / 100) * 180;
    const a2 = 180 - (endPct / 100) * 180;
    const r1 = (a1 * Math.PI) / 180;
    const r2 = (a2 * Math.PI) / 180;
    const x1 = cx + r * Math.cos(r1);
    const y1 = cy - r * Math.sin(r1);
    const x2 = cx + r * Math.cos(r2);
    const y2 = cy - r * Math.sin(r2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: 16,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
      }}
    >
      <svg viewBox="0 0 200 120" width="160" height="96" aria-hidden="true">
        <path
          d={arcPath(0, 30)}
          stroke="#a7f3d0"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={arcPath(30, 60)}
          stroke="#fde68a"
          strokeWidth="16"
          fill="none"
        />
        <path
          d={arcPath(60, 100)}
          stroke="#fecaca"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="var(--navy)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="6" fill="var(--navy)" />
      </svg>

      <div>
        <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>
          {clamped}%
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--gray)',
            letterSpacing: '0.04em',
            marginTop: 6,
          }}
        >
          {level}
        </div>
      </div>
    </div>
  );
}

export default RiskGauge;