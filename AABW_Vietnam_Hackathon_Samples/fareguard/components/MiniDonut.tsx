export default function MiniDonut({
  segments,
  size = 40,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 15;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-alt)" strokeWidth="6" />
        {segments.map((s, i) => {
          const dash = (s.value / total) * circumference;
          const circle = (
            <circle
              key={i}
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="6"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 20 20)"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="flex flex-col gap-0.5">
        {segments.map((s, i) => (
          <span key={i} className="text-[10px] text-text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}
