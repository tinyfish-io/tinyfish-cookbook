"use client";

import { motion } from "framer-motion";
import { SITES } from "@/lib/seed";
import type { AgentStatus } from "@/lib/types";
import { relativeTime } from "@/lib/format";

export default function AgentStatusStrip({
  agentStatuses,
  running,
}: {
  agentStatuses: Record<string, AgentStatus>;
  running: boolean;
}) {
  return (
    <div className="card-surface rounded-xl p-4">
      <p className="text-xs text-text-secondary mb-3">Sources · 6 agents in parallel</p>
      <div className="relative flex items-center justify-between">
        {/* connecting line evokes a network/pipeline rather than a flat grid of tiles */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-px" style={{ background: "var(--border)" }} />
        {SITES.map((site) => {
          const status = agentStatuses[site.id];
          const hasSynced = Boolean(status); // color stays the same whether it succeeded or errored — only the tooltip/log differs
          return (
            <div key={site.id} className="relative flex flex-col items-center gap-1.5 z-10 flex-1">
              <motion.div
                animate={running && !status ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-3 h-3 rounded-full border-2"
                style={{
                  background: hasSynced ? "var(--accent)" : "var(--surface-alt)",
                  borderColor: hasSynced ? "var(--accent)" : "var(--border)",
                }}
              />
              <p className="text-[10px] text-text-secondary text-center leading-tight max-w-[64px]">{site.name}</p>
              <p className="text-[9px] text-text-muted font-mono">
                {status ? relativeTime(status.lastSyncedAt) : running ? "syncing…" : "—"}
              </p>
              {status && status.programsFound > 0 && (
                <span className="text-[9px] font-mono px-1.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  +{status.programsFound}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
