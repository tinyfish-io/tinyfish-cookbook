"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCcw, ExternalLink, BedDouble, Ruler } from "lucide-react";
import AgentStatusStrip from "@/components/AgentStatusStrip";
import SiteFavicon from "@/components/SiteFavicon";
import { fetchJson } from "@/lib/fetchJson";
import { formatVnd } from "@/lib/format";
import { PORTALS } from "@/lib/seed";
import type { TrackedSearch, Listing, AgentStatus } from "@/lib/types";

export default function SearchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [search, setSearch] = useState<TrackedSearch | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/searches/${params.id}`);
      setSearch(data.search);
      setListings(data.listings);
      setAgentStatuses(data.agentStatuses ?? {});
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, [params.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function runSweepNow() {
    setTriggering(true);
    const res = await fetch(`/api/searches/${params.id}/sweep`, { method: "POST" });
    const data = await res.json();
    setNote(data.status === "dispatched" ? "Triggered — this can take a few minutes." : data.status === "completed" ? "Done." : "Couldn't trigger a sweep right now.");
    await load();
    setTriggering(false);
    setTimeout(() => setNote(null), 6000);
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load this search</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded || !search) return <div className="skeleton h-96 rounded-xl" />;

  const running = agentStatuses && Object.keys(agentStatuses).length > 0 && Object.keys(agentStatuses).length < PORTALS.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push("/")} className="text-xs text-text-secondary hover:text-accent transition-colors flex items-center gap-1.5">
          <ArrowLeft size={13} /> Back to tracked areas
        </button>
        <button
          onClick={runSweepNow}
          disabled={triggering}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <RefreshCcw size={12} className={triggering ? "animate-spin" : ""} /> {triggering ? "Starting…" : "Check now"}
        </button>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-2xl">{search.area}</h1>
        <p className="text-sm text-text-muted mt-1 capitalize">
          {search.propertyType} · {search.intent === "rent" ? "for rent" : "for sale"}
          {search.clientName && ` · ${search.clientName}`}
        </p>
        {note && <p className="text-xs text-accent mt-2">{note}</p>}
      </div>

      <AgentStatusStrip agentStatuses={agentStatuses} running={running} />

      {listings.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No listings found yet — check back after the next sweep.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PORTALS.map((portal) => {
            const portalListings = listings.filter((l) => l.portalId === portal.id);
            if (portalListings.length === 0) return null;
            const domain = new URL(portal.url).hostname;
            return (
              <motion.div key={portal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                  <SiteFavicon domain={domain} name={portal.name} size={22} />
                  <p className="text-sm font-medium">{portal.name}</p>
                </div>
                <div className="space-y-3">
                  {portalListings.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block text-xs hover:bg-surface-alt rounded-md p-2 -m-2 transition-colors">
                      <p className="font-medium mb-1 flex items-center gap-1">
                        {l.title} <ExternalLink size={10} className="text-text-muted shrink-0" />
                      </p>
                      <div className="flex items-center gap-3 text-text-secondary">
                        <span className="tabular font-medium text-accent">{formatVnd(l.price)}</span>
                        {l.areaSqm && (
                          <span className="flex items-center gap-0.5">
                            <Ruler size={10} /> {l.areaSqm}m²
                          </span>
                        )}
                        {l.bedrooms && (
                          <span className="flex items-center gap-0.5">
                            <BedDouble size={10} /> {l.bedrooms}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
