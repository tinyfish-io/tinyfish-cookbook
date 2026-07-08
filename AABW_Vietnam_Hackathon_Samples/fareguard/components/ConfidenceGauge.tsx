function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function ConfidenceGauge({ percent, size = 108 }: { percent: number; size?: number }) {
  const cx = 50;
  const cy = 50;
  const r = 40;
  const clamped = Math.max(2, Math.min(100, percent));
  const trackPath = describeArc(cx, cy, r, 180, 0);
  const valuePath = describeArc(cx, cy, r, 180, 180 - 1.8 * clamped);
  const height = size * 0.62;

  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: size }}>
      <div className="relative" style={{ width: size, height }}>
        <svg viewBox="0 0 100 58" width={size} height={height}>
          <path d={trackPath} fill="none" stroke="var(--border)" strokeWidth="9" strokeLinecap="round" />
          <path d={valuePath} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-0.5">
          <span className="text-xl font-medium tabular">{clamped}%</span>
        </div>
      </div>
      <p className="text-[11px] text-text-muted mt-1">Confidence score</p>
    </div>
  );
}
