"use client";

import { SITES } from "@/lib/seed";
import type { SitePriceSeries, RouteCode, RouteRecommendation, RouteInfo } from "@/lib/types";
import { formatVnd } from "@/lib/format";

function cheapestFare(priceSeries: Record<string, SitePriceSeries>, routeCode: RouteCode) {
  let best: number | null = null;
  for (const site of SITES) {
    const series = priceSeries[`${site.id}__${routeCode}`];
    if (!series || series.history.length === 0) continue;
    const price = series.history[series.history.length - 1].priceVnd;
    if (best === null || price < best) best = price;
  }
  return best;
}

function trendPct(priceSeries: Record<string, SitePriceSeries>, routeCode: RouteCode) {
  const series = priceSeries[`vietjet__${routeCode}`];
  if (!series || series.history.length < 4) return 0;
  const recent = series.history.slice(-3).reduce((a, p) => a + p.priceVnd, 0) / 3;
  const earlier = series.history.slice(0, 3).reduce((a, p) => a + p.priceVnd, 0) / 3;
  return ((recent - earlier) / earlier) * 100;
}

function routeStatus(rec: RouteRecommendation | undefined): { label: string; className: string } {
  if (!rec) return { label: "Monitoring", className: "bg-surface-alt text-text-secondary" };
  const daysUntil = (new Date(rec.bookByDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (rec.confidence === "high" && daysUntil <= 3) {
    return { label: "Book now", className: "bg-warning/15 text-warning" };
  }
  return { label: "Monitoring", className: "bg-surface-alt text-text-secondary" };
}

export default function RouteTable({
  priceSeries,
  recommendations,
  routes,
  selectedRoute,
  onSelect,
}: {
  priceSeries: Record<string, SitePriceSeries>;
  recommendations: RouteRecommendation[];
  routes: RouteInfo[];
  selectedRoute: RouteCode | null;
  onSelect: (route: RouteCode) => void;
}) {
  if (routes.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">No routes yet — add one above to get started.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-text-secondary text-xs">
          <th className="font-normal pb-2">Route</th>
          <th className="font-normal pb-2">Fare</th>
          <th className="font-normal pb-2">Trend</th>
          <th className="font-normal pb-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route) => {
          const fare = cheapestFare(priceSeries, route.code);
          const trend = trendPct(priceSeries, route.code);
          const active = route.code === selectedRoute;
          const status = routeStatus(recommendations.find((r) => r.routeCode === route.code));
          return (
            <tr
              key={route.code}
              onClick={() => onSelect(route.code)}
              className={`border-t border-border cursor-pointer transition-colors ${
                active ? "bg-accent-soft" : "hover:bg-surface-alt"
              }`}
            >
              <td className="py-2.5">
                <span className="inline-flex items-center gap-2">
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  {route.from} → {route.to}
                </span>
              </td>
              <td className="py-2.5 tabular">{fare !== null ? formatVnd(fare) : "—"}</td>
              <td className="py-2.5">
                <span className={trend < -0.5 ? "text-success" : trend > 0.5 ? "text-danger" : "text-text-secondary"}>
                  {trend > 0.5 ? "↑" : trend < -0.5 ? "↓" : "→"} {Math.abs(trend).toFixed(1)}%
                </span>
              </td>
              <td className="py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
