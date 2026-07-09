export default function KpiCard({
  label,
  value,
  hint,
  hintColor,
}: {
  label: string;
  value: string;
  hint?: string;
  hintColor?: string;
}) {
  return (
    <div className="card-surface rounded-lg p-4">
      <p className="text-[11px] tracking-wide text-text-muted mb-2">{label}</p>
      <p className="text-2xl font-medium tabular font-mono">{value}</p>
      {hint && (
        <p className="text-xs mt-1" style={{ color: hintColor ?? "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
