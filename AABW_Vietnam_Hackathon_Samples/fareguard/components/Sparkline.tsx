"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const chartData = data.map((value, i) => ({ i, value }));
  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
