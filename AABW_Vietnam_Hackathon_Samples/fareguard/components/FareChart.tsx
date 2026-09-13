"use client";

import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SitePriceSeries, RouteCode, RouteRecommendation } from "@/lib/types";
import { SITES } from "@/lib/seed";
import { SITE_COLORS } from "@/lib/siteColors";
import { formatDate, formatVndShort } from "@/lib/format";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const seen = new Set<string>();
  const rows = payload
    .filter((p: any) => {
      if (typeof p.value !== "number") return false;
      if (typeof p.dataKey !== "string") return false; // excludes the invisible book-by annotation line
      if (!SITES.some((s) => s.id === p.dataKey)) return false; // excludes the gradient-fill Area
      if (seen.has(p.dataKey)) return false; // excludes the Area+Line double-count for vietjet
      seen.add(p.dataKey);
      return true;
    })
    .sort((a: any, b: any) => a.value - b.value);
  if (rows.length === 0) return null;

  return (
    <div className="card-elevated rounded-lg px-3 py-2.5 text-xs min-w-[160px]">
      <p className="text-text-muted mb-1.5">{formatDate(label)}</p>
      {rows.map((row: any, i: number) => {
        const site = SITES.find((s) => s.id === row.dataKey);
        return (
          <div key={row.dataKey} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: SITE_COLORS[row.dataKey] }} />
              {site?.name ?? row.dataKey}
            </span>
            <span className={`tabular ${i === 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}>
              {formatVndShort(row.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TodayMarker({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--accent)" />
      <circle cx={cx} cy={cy} r={3.5} fill="none" stroke="var(--accent)" strokeWidth="1.5">
        <animate attributeName="r" values="3.5;11;3.5" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0;0.55" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function BookByAnnotation({ cx, cy, text }: { cx?: number; cy?: number; text: string }) {
  if (cx === undefined || cy === undefined) return null;
  const width = text.length * 5.6 + 16;
  return (
    <g transform={`translate(${cx}, ${cy - 34})`}>
      <rect x={-width / 2} y={-11} width={width} height={20} rx={10} fill="var(--accent)" />
      <text x={0} y={3} textAnchor="middle" fontSize="10" fontWeight={600} fill="var(--bg)">
        {text}
      </text>
      <line x1={0} y1={9} x2={0} y2={26} stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" />
    </g>
  );
}

export default function FareChart({
  priceSeries,
  routeCode,
  recommendation,
}: {
  priceSeries: Record<string, SitePriceSeries>;
  routeCode: RouteCode;
  recommendation?: RouteRecommendation;
}) {
  const seriesForRoute = SITES.map((site) => priceSeries[`${site.id}__${routeCode}`]).filter(Boolean);
  if (seriesForRoute.length === 0) {
    return <div className="h-64 flex items-center justify-center text-text-muted text-sm">No data yet</div>;
  }

  const length = seriesForRoute[0].history.length;
  const chartData = Array.from({ length }).map((_, i) => {
    const row: Record<string, number | string> = {
      timestamp: seriesForRoute[0].history[i]?.timestamp ?? "",
    };
    seriesForRoute.forEach((s) => {
      row[s.siteId] = s.history[i]?.priceVnd ?? null;
    });
    return row;
  });

  const lastIndex = chartData.length - 1;
  const bookByLabel = recommendation ? `Book by ${formatDate(recommendation.bookByDate)}` : null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 48, right: 90, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vietjetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SITE_COLORS.vietjet} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SITE_COLORS.vietjet} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeOpacity={0.6} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => formatDate(v)}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            tickFormatter={(v) => formatVndShort(v)}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="vietjet"
            stroke="none"
            fill="url(#vietjetFill)"
            isAnimationActive={false}
            connectNulls
            legendType="none"
          />
          {seriesForRoute.map((s) => {
            const isVietjet = s.siteId === "vietjet";
            return (
              <Line
                key={s.siteId}
                type="monotone"
                dataKey={s.siteId}
                stroke={SITE_COLORS[s.siteId]}
                strokeWidth={isVietjet ? 2.5 : 1.5}
                dot={
                  isVietjet
                    ? (props: any) =>
                        props.index === lastIndex ? (
                          <TodayMarker key={`today-${props.index}`} cx={props.cx} cy={props.cy} />
                        ) : (
                          <g key={`dot-${props.index}`} />
                        )
                    : false
                }
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
          {bookByLabel &&
            (() => {
              const vietjet = chartData[lastIndex];
              const y = typeof vietjet?.vietjet === "number" ? vietjet.vietjet : null;
              if (y === null) return null;
              return (
                <Line
                  dataKey={() => y}
                  stroke="none"
                  dot={(props: any) =>
                    props.index === lastIndex ? (
                      <BookByAnnotation key="book-by" cx={props.cx} cy={props.cy} text={bookByLabel} />
                    ) : (
                      <g key={`skip-${props.index}`} />
                    )
                  }
                  isAnimationActive={false}
                  legendType="none"
                />
              );
            })()}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border">
        {SITES.map((site) => (
          <div key={site.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: SITE_COLORS[site.id] }} />
            <span className="text-[11px] text-text-secondary">{site.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
