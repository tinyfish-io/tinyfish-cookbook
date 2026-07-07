"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, PenLine, CheckCircle2, Send } from "lucide-react";
import type { ServiceRequest, ServiceStage } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";

const STAGE_META: Record<ServiceStage, { label: string; icon: typeof AlertTriangle; color: string }> = {
  flagged: { label: "Flagged", icon: AlertTriangle, color: "var(--warning)" },
  drafting: { label: "Drafting", icon: PenLine, color: "var(--accent)" },
  ready: { label: "Ready for review", icon: CheckCircle2, color: "var(--success)" },
  submitted: { label: "Submitted", icon: Send, color: "var(--text-secondary)" },
};

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/service-requests");
      setRequests(data.requests);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load service requests</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded) return <div className="skeleton h-96 rounded-xl" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Service requests</h1>
        <p className="text-sm text-text-muted mt-1">
          Auto-drafted when a vehicle passes its service interval, or manually via "Apply for service" on the Fleet Overview tab.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card-surface rounded-xl p-10 text-center">
          <p className="text-sm text-text-muted">No service requests yet.</p>
        </div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-3">
          {requests.map((r) => {
            const meta = STAGE_META[r.stage];
            const Icon = meta.icon;
            return (
              <motion.div
                key={r.id}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                className="card-surface rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={13} style={{ color: meta.color }} className={r.stage === "drafting" ? "animate-pulse" : ""} />
                    <span className="text-xs" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{r.vehicleName}</p>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{r.reason}</p>
                </div>
                <div className="shrink-0">
                  {(r.stage === "ready" || r.stage === "submitted") && (
                    <Link href={`/service/${r.id}`} className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
                      {r.stage === "ready" ? "Review" : "View"}
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
