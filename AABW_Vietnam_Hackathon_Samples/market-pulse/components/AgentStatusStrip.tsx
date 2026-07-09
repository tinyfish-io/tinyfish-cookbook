"use client";

import { motion } from "framer-motion";
import { SITES } from "@/lib/seed";
import type { AgentStatus } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import SiteFavicon from "./SiteFavicon";

export default function AgentStatusStrip({
  agentStatuses,
  running,
}: {
  agentStatuses: Record<string, AgentStatus>;
  running: boolean;
}) {
  return (
    <div className="card-surface rounded-xl p-4 mb-6">
      <p className="text-xs text-text-secondary mb-3">5 agents in parallel · Laptops & PC components</p>
      <div className="grid grid-cols-5 gap-3">
        {SITES.map((site) => {
          const status = agentStatuses[site.id];
          const domain = new URL(site.url).hostname;
          return (
            <div key={site.id} className="flex flex-col items-center gap-1.5 text-center">
              <div className="relative">
                <SiteFavicon domain={domain} name={site.name} size={32} />
                <motion.span
                  animate={running && !status ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: status ? "var(--accent)" : running ? "var(--warning)" : "var(--surface-alt)",
                    borderColor: "var(--surface)",
                  }}
                />
              </div>
              <p className="text-[10px] text-text-secondary leading-tight">{site.name}</p>
              <p className="text-[9px] text-text-muted tabular">{status ? relativeTime(status.lastSyncedAt) : running ? "syncing…" : "—"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
