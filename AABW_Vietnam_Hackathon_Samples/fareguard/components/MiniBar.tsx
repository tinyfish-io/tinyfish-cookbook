export default function MiniBar({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);

  if (total === 0) {
    return (
      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-surface-alt" />
        <p className="text-[10px] text-text-muted mt-1.5">No requests yet</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-surface-alt">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex gap-3 mt-1.5">
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
