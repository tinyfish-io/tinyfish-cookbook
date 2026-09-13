"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, PenLine, CheckCircle2, Send } from "lucide-react";
import type { RestockRequest, RestockStage } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";

const STAGE_META: Record<RestockStage, { label: string; icon: typeof AlertTriangle; color: string }> = {
  flagged: { label: "Flagged", icon: AlertTriangle, color: "var(--warning)" },
  drafting: { label: "Drafting", icon: PenLine, color: "var(--accent)" },
  ready: { label: "Ready for review", icon: CheckCircle2, color: "var(--success)" },
  submitted: { label: "Submitted", icon: Send, color: "var(--text-secondary)" },
};

export default function RestockPage() {
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/restock-requests");
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
  }, [load]);

  async function handleDraft(id: string) {
    setDrafting(id);
    await fetch(`/api/restock-requests/${id}/draft`, { method: "POST" });
    await load();
    setDrafting(null);
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load stock report</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded) return <div className="skeleton h-96" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Stock report</h1>
        <p className="text-sm text-text-muted mt-1">
          Products flagged when our stock drops below threshold. Review, let AI draft the supplier request, then approve.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card-surface rounded-xl p-10 text-center">
          <p className="text-sm text-text-muted">No restock flags right now — everything's above threshold.</p>
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
                    <Icon size={13} style={{ color: meta.color }} />
                    <span className="text-xs" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{r.productName}</p>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{r.reason}</p>
                  <p className="text-[11px] text-text-muted mt-1">Supplier: {r.supplierName}</p>
                </div>
                <div className="shrink-0">
                  {r.stage === "flagged" && (
                    <button
                      onClick={() => handleDraft(r.id)}
                      disabled={drafting === r.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-burgundy text-accent font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {drafting === r.id ? "Drafting…" : "Draft with AI"}
                    </button>
                  )}
                  {(r.stage === "ready" || r.stage === "submitted") && (
                    <Link href={`/restock/${r.id}`} className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
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
