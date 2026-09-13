import type { ReactNode } from "react";
import CountUp from "./CountUp";

export default function KpiCard({
  label,
  value,
  format,
  hint,
  visual,
  icon,
  iconTint = "var(--accent)",
  delta,
  deltaColor = "var(--success)",
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  hint?: string;
  visual?: ReactNode;
  icon?: ReactNode;
  iconTint?: string;
  delta?: string;
  deltaColor?: string;
}) {
  return (
    <div className="card-surface rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-text-secondary">{label}</p>
        {icon && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${iconTint}1A`, color: iconTint }}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-medium flex items-baseline gap-2">
        <CountUp value={value} format={format} />
        {delta && (
          <span className="text-xs font-medium" style={{ color: deltaColor }}>
            {delta}
          </span>
        )}
      </p>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
      {visual && <div className="mt-3 flex-1 flex items-end">{visual}</div>}
    </div>
  );
}
