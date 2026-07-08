"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Play, DollarSign, MapPin, Clock, Globe } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import AgentSwarm from "@/components/AgentSwarm";
import FareChart from "@/components/FareChart";
import RouteTable from "@/components/RouteTable";
import RecommendationBanner from "@/components/RecommendationBanner";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import Sparkline from "@/components/Sparkline";
import RouteMiniIcon from "@/components/RouteMiniIcon";
import MiniBar from "@/components/MiniBar";
import MiniDonut from "@/components/MiniDonut";
import AddRouteForm from "@/components/AddRouteForm";
import { SITES } from "@/lib/seed";
import type { SitePriceSeries, AgentStatus, RouteRecommendation, RouteCode, BookingRequest, ScheduleMeta, RouteInfo } from "@/lib/types";
import { formatVnd } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export default function DashboardPage() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [priceSeries, setPriceSeries] = useState<Record<string, SitePriceSeries>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [meta, setMeta] = useState<ScheduleMeta | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteCode | null>(null);
  const [running, setRunning] = useState(false);
  const [triggerNote, setTriggerNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [track, analyze, booking, routesData] = await Promise.all([
        fetchJson("/api/track"),
        fetchJson("/api/analyze"),
        fetchJson("/api/booking-requests"),
        fetchJson("/api/routes"),
      ]);
      setPriceSeries(track.priceSeries);
      setAgentStatuses(track.agentStatuses);
      setMeta(track.meta);
      setRecommendations(analyze.recommendations);
      setBookingRequests(booking.requests);
      setRoutes(routesData.routes);
      setSelectedRoute((current) => current ?? routesData.routes[0]?.code ?? null);
      setLoadError(null);
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setLoadError(err instanceof Error ? err.message : "Unknown error loading data");
      setLoaded(true); // stop showing the skeleton — show the error instead
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // While no sweep has ever completed yet, poll quietly in the background —
  // this is what picks up the local-dev bootstrap sweep once it finishes,
  // without blocking the initial paint.
  useEffect(() => {
    if (meta?.lastSweepAt) return;
    const id = setInterval(() => {
      loadAll();
    }, 8000);
    return () => clearInterval(id);
  }, [meta?.lastSweepAt, loadAll]);

  async function runSweepNow() {
    setRunning(true);
    setTriggerNote(null);
    const res = await fetch("/api/track", { method: "POST" });
    const data = await res.json();
    if (data.status === "dispatched") {
      setTriggerNote("Triggered the GitHub Actions sweep — data will update in a few minutes once it finishes.");
    } else if (data.status === "already_triggered") {
      setTriggerNote("Already running — give it a couple of minutes.");
    } else {
      setTriggerNote("Sweep complete.");
    }
    await loadAll();
    setRunning(false);
  }

  const savingsIdentified = useMemo(() => {
    let total = 0;
    routes.forEach((route) => {
      const series = SITES.map((s) => priceSeries[`${s.id}__${route.code}`]).filter(Boolean) as SitePriceSeries[];
      series.forEach((s) => {
        const prices = s.history.map((p) => p.priceVnd);
        if (prices.length < 2) return;
        total += Math.max(...prices) - prices[prices.length - 1];
      });
    });
    return total;
  }, [priceSeries, routes]);

  const marketTrend = useMemo(() => {
    const key = routes[0] ? `vietjet__${routes[0].code}` : null;
    const series = key ? priceSeries[key] : null;
    return series ? series.history.map((p) => p.priceVnd) : [];
  }, [priceSeries, routes]);

  const savingsDeltaPct = useMemo(() => {
    if (marketTrend.length < 2) return null;
    const first = marketTrend[0];
    const last = marketTrend[marketTrend.length - 1];
    if (!first) return null;
    return ((first - last) / first) * 100; // price dropping = positive savings trend
  }, [marketTrend]);

  const queueCount = bookingRequests.filter((r) => r.status === "waiting").length;
  const bookedCount = bookingRequests.filter((r) => r.status === "booked").length;

  if (loadError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Live fare and demand tracking across Vietnam routes.</p>
        </div>
        <div className="card-surface rounded-xl p-6">
          <p className="text-sm font-medium text-danger mb-1">Couldn't load dashboard data</p>
          <p className="text-xs text-text-muted mb-4 break-words">{loadError}</p>
          <p className="text-xs text-text-muted mb-4">
            Most often this means an env var (KV_REST_API_URL / KV_REST_API_TOKEN) is missing or wrong on this
            deployment. Check Vercel → your project → Deployments → the current deployment → Runtime Logs for the
            actual server-side error.
          </p>
          <button
            onClick={() => {
              setLoaded(false);
              loadAll();
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-soft transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Live fare and demand tracking across Vietnam routes.</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const selectedRouteInfo = routes.find((r) => r.code === selectedRoute);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Live fare and demand tracking across Vietnam routes.</p>
        </div>
        <div className="flex items-center gap-2">
          <AddRouteForm onAdded={loadAll} />
          <button
            onClick={runSweepNow}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded-md bg-accent text-white flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Play size={12} fill="currentColor" /> {running ? "Running…" : "Run sweep now"}
          </button>
        </div>
      </div>

      <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Savings identified"
            value={savingsIdentified}
            format={formatVnd}
            hint="from tracked fare sweeps"
            icon={<DollarSign size={14} />}
            iconTint="var(--success)"
            delta={savingsDeltaPct !== null ? `${savingsDeltaPct >= 0 ? "+" : ""}${savingsDeltaPct.toFixed(0)}%` : undefined}
            deltaColor={savingsDeltaPct !== null && savingsDeltaPct >= 0 ? "var(--success)" : "var(--danger)"}
            visual={<Sparkline data={marketTrend} color="var(--success)" />}
          />
          <KpiCard
            label="Routes monitored"
            value={routes.length}
            format={(v) => String(Math.round(v))}
            hint="domestic & international"
            icon={<MapPin size={14} />}
            iconTint="var(--accent)"
            delta={routes.length > 2 ? `+${routes.length - 2}` : undefined}
            deltaColor="var(--accent)"
            visual={<RouteMiniIcon />}
          />
          <KpiCard
            label="Auto-book queue"
            value={queueCount}
            format={(v) => String(Math.round(v))}
            hint={`${bookedCount} booked this period`}
            icon={<Clock size={14} />}
            iconTint="var(--warning)"
            delta={queueCount > 0 ? `${queueCount} pending` : undefined}
            deltaColor="var(--warning)"
            visual={
              <MiniBar
                segments={[
                  { value: queueCount, color: "var(--text-muted)", label: "waiting" },
                  { value: bookedCount, color: "var(--success)", label: "booked" },
                ]}
              />
            }
          />
          <KpiCard
            label="Sites tracked"
            value={SITES.length}
            format={(v) => String(Math.round(v))}
            hint={`${SITES.filter((s) => s.type === "OTA").length} OTAs`}
            icon={<Globe size={14} />}
            iconTint="var(--accent)"
            delta={`${SITES.filter((s) => s.type === "Airline").length} airlines`}
            deltaColor="var(--text-secondary)"
            visual={
              <MiniDonut
                segments={[
                  { value: SITES.filter((s) => s.type === "Airline").length, color: "var(--accent)", label: "Airlines" },
                  { value: SITES.filter((s) => s.type === "OTA").length, color: "var(--text-muted)", label: "OTAs" },
                ]}
              />
            }
          />
        </motion.div>

        <motion.div variants={item}>
          <AgentSwarm agentStatuses={agentStatuses} meta={meta} onRunNow={runSweepNow} running={running} routeCount={routes.length} />
          {triggerNote && <p className="text-xs text-text-muted mt-2">{triggerNote}</p>}
        </motion.div>

        {selectedRoute && (
          <motion.div variants={item} className="card-surface rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-medium text-sm">{selectedRouteInfo?.label}, economy</p>
                <p className="text-xs text-text-muted mt-0.5">14-day fare history across 7 sites</p>
              </div>
            </div>
            <FareChart
              priceSeries={priceSeries}
              routeCode={selectedRoute}
              recommendation={recommendations.find((r) => r.routeCode === selectedRoute)}
            />
          </motion.div>
        )}

        {selectedRoute && (
          <motion.div variants={item}>
            <RecommendationBanner recommendations={recommendations} routeCode={selectedRoute} meta={meta} />
          </motion.div>
        )}

        <motion.div variants={item} id="monitored-routes" className="card-surface rounded-xl p-5 scroll-mt-8">
          <p className="text-xs text-text-secondary mb-2">Monitored routes — click to view chart</p>
          <RouteTable
            priceSeries={priceSeries}
            recommendations={recommendations}
            routes={routes}
            selectedRoute={selectedRoute}
            onSelect={setSelectedRoute}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
