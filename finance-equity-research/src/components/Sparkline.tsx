export function Sparkline({
  points,
  rust = false,
  width = 120,
  height = 40,
}: {
  points: number[];
  rust?: boolean;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - 6 - ((value - min) / span) * (height - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mt-1.5" aria-hidden>
      <polyline points={coords} fill="none" stroke={rust ? "var(--color-rust)" : "var(--color-ink)"} strokeWidth="1.5" />
    </svg>
  );
}
