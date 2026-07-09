"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, TrendingDown, TrendingUp, CircleDot } from "lucide-react";
import Hero from "@/components/Hero";
import AgentStatusStrip from "@/components/AgentStatusStrip";
import CategoryTabs from "@/components/CategoryTabs";
import SiteFavicon from "@/components/SiteFavicon";
import Countdown from "@/components/Countdown";
import type { Product, CompetitorSite, CompetitorListing, AgentStatus, Category, ScheduleMeta } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";
import { formatVnd } from "@/lib/format";
import { getNextScheduledRun } from "@/lib/date";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<CompetitorSite[]>([]);
  const [listings, setListings] = useState<Record<string, CompetitorListing>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [meta, setMeta] = useState<ScheduleMeta | null>(null);
  const [category, setCategory] = useState<Category>("Laptops");
  const [triggering, setTriggering] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // "Running" is derived from real backend state, not just whether the
  // button was clicked — a sweep is genuinely in progress whenever the last
  // start is newer than the last completion. This is what actually lets
  // the agent strip update live as each site finishes, poll by poll,
  // instead of looking frozen until the whole sweep is done.
  // A sweep marked "started" but never "completed" is either genuinely
  // still running, OR it was abandoned — the process that was running it
  // got killed (e.g. a dev-server restart mid-sweep) before it ever reached
  // the final write. Without a cutoff, that leftover marker would make the
  // UI think a sweep is running forever, even with nothing actually
  // executing. 10 minutes is well beyond how long 5 sites should ever take.
  const SWEEP_ABANDONED_AFTER_MS = 6 * 60 * 1000;
  const running = Boolean(
    meta?.sweepStartedAt &&
      (!meta.lastSweepAt || new Date(meta.sweepStartedAt) > new Date(meta.lastSweepAt)) &&
      Date.now() - new Date(meta.sweepStartedAt).getTime() < SWEEP_ABANDONED_AFTER_MS
  );
  const doneCount = Object.keys(agentStatuses).length;

  const loadAll = useCallback(async () => {
    try {
      const [productsData, sweepData] = await Promise.all([fetchJson("/api/products"), fetchJson("/api/sweep")]);
      setProducts(productsData.products);
      setSites(productsData.sites);
      setListings(productsData.listings);
      setMeta(sweepData.meta);
      setAgentStatuses(sweepData.agentStatuses ?? {});
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = setInterval(loadAll, running ? 3000 : 8000);
    return () => clearInterval(id);
  }, [loadAll, running]);

  async function runSweepNow() {
    setTriggering(true);
    await fetch("/api/sweep", { method: "POST" });
    await loadAll();
    setTriggering(false);
  }

  async function resetStuckSweep() {
    await fetch("/api/sweep", { method: "DELETE" });
    await loadAll();
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load the dashboard</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-52 rounded-2xl" />
        <div className="skeleton h-24" />
        <div className="grid grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-64" />
          ))}
        </div>
      </div>
    );
  }

  const categoryProducts = products.filter((p) => p.category === category);
  const usingRealAgents = meta?.usingRealAgents ?? false;

  return (
    <div>
      <Hero
        eyebrow="Ho Chi Minh City · Vietnam"
        title="Market"
        titleAccent="Pulse"
        subtitle="Live competitor pricing and stock tracking across Vietnam's electronics retailers."
        actions={
          <>
            <button
              onClick={runSweepNow}
              disabled={triggering || running}
              className="text-xs px-3 py-2 rounded-lg bg-burgundy text-accent font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <RefreshCcw size={12} className={triggering || running ? "animate-spin" : ""} />{" "}
              {running ? `Sweeping… (${doneCount}/5 done)` : triggering ? "Starting…" : "Run sweep now"}
            </button>
            {running && (
              <button onClick={resetStuckSweep} className="text-xs text-text-muted hover:text-accent underline transition-colors">
                Not actually running? Reset
              </button>
            )}
          </>
        }
        status={
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>
              Next sweep: <Countdown targetIso={getNextScheduledRun(8)} />
            </span>
            <span className="flex items-center gap-1.5">
              <CircleDot size={11} className={usingRealAgents ? "text-accent" : "text-text-muted"} />
              {usingRealAgents ? "Live agents" : "Simulated"}
            </span>
          </div>
        }
      />

      <AgentStatusStrip agentStatuses={agentStatuses} running={running} />

      <CategoryTabs value={category} onChange={setCategory} />

      <div className="card-surface rounded-xl p-4 mb-5">
        <p className="text-xs text-text-secondary mb-3">Our stock & price</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categoryProducts.map((product) => {
            const isLow = product.ourStock <= product.lowStockThreshold;
            return (
              <div key={product.id} className="flex items-center justify-between bg-surface-alt rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-text-muted tabular mt-0.5">{formatVnd(product.ourPrice)}</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium tabular"
                  style={{
                    background: isLow ? "rgba(184,114,27,0.14)" : "rgba(62,138,94,0.12)",
                    color: isLow ? "var(--warning)" : "var(--success)",
                  }}
                >
                  {product.ourStock} in stock
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {sites
          .filter((site) => categoryProducts.some((p) => listings[`${site.id}__${p.id}`]))
          .map((site) => {
            const domain = new URL(site.url).hostname;
            return (
              <motion.div key={site.id} variants={item} className="card-surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                  <SiteFavicon domain={domain} name={site.name} size={24} />
                  <p className="text-sm font-medium">{site.name}</p>
                </div>
                <div className="space-y-3">
                  {categoryProducts.map((product) => {
                    const listing = listings[`${site.id}__${product.id}`];
                    if (!listing) return null;
                    const cheaper = listing.price !== null && listing.price < product.ourPrice;
                    return (
                      <div key={product.id} className="text-xs">
                        <p className="text-text-primary font-medium mb-1.5 leading-tight">{product.name}</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-text-muted">Price</span>
                          {listing.price ? (
                            <span className={`tabular flex items-center gap-1 ${cheaper ? "text-danger" : "text-text-secondary"}`}>
                              {formatVnd(listing.price)}
                              {cheaper ? <TrendingDown size={12} /> : <TrendingUp size={12} className="text-success" />}
                            </span>
                          ) : (
                            <span className="text-text-muted">No data</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Stock</span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: listing.inStock === false ? "rgba(168,54,47,0.12)" : listing.inStock === true ? "rgba(62,138,94,0.12)" : "var(--surface-alt)",
                              color: listing.inStock === false ? "var(--danger)" : listing.inStock === true ? "var(--success)" : "var(--text-muted)",
                            }}
                          >
                            {listing.inStock === false ? "Out of stock" : listing.inStock === true ? "In stock" : "Unclear"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
      </motion.div>

      {sites.filter((site) => categoryProducts.some((p) => listings[`${site.id}__${p.id}`])).length === 0 && (
        <p className="text-sm text-text-muted text-center py-10">No competitor data yet for this category — run a sweep to populate it.</p>
      )}
    </div>
  );
}
