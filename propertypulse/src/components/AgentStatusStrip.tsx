"use client";

import { motion } from "framer-motion";
import { PORTALS } from "@/lib/seed";
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
      <p className="text-xs text-text-secondary mb-3">5 agents in parallel · property portals</p>
      <div className="grid grid-cols-5 gap-3">
        {PORTALS.map((portal) => {
          const status = agentStatuses[portal.id];
          const domain = new URL(portal.url).hostname;
          return (
            <div key={portal.id} className="flex flex-col items-center gap-1.5 text-center">
              <div className="relative">
                <SiteFavicon domain={domain} name={portal.name} size={32} />
                <motion.span
                  animate={running && !status ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    // Always shows the same accent color whether the agent
                    // succeeded or errored — only the console log and
                    // listingsFound count carry that distinction; the
                    // status dot just says "checked" vs "still working".
                    background: status ? "var(--accent)" : running ? "var(--warning)" : "var(--surface-alt)",
                    borderColor: "var(--surface)",
                  }}
                />
              </div>
              <p className="text-[10px] text-text-secondary leading-tight">{portal.name}</p>
              <p className="text-[9px] text-text-muted tabular">{status ? relativeTime(status.lastSyncedAt) : running ? "checking…" : "—"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
