"use client";

import { SITES } from "@/lib/seed";
import type { AgentStatus, ScheduleMeta } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import Countdown from "./Countdown";
import SiteFavicon from "./SiteFavicon";

export default function AgentSwarm({
  agentStatuses,
  meta,
  onRunNow,
  running,
  routeCount,
}: {
  agentStatuses: Record<string, AgentStatus>;
  meta: ScheduleMeta | null;
  onRunNow: () => void;
  running: boolean;
  routeCount: number;
}) {
  const nextSweepAt =
    meta?.lastSweepAt && meta.sweepIntervalMs
      ? new Date(new Date(meta.lastSweepAt).getTime() + meta.sweepIntervalMs).toISOString()
      : null;

  return (
    <div className="card-surface rounded-xl p-5 relative overflow-hidden">
      {running && (
        <div
          className="scan-sweep absolute top-0 bottom-0 w-1/3 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, var(--accent-soft), transparent)" }}
        />
      )}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            Agent sweep
            {meta && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  meta.usingRealAgents ? "bg-accent-soft text-accent border border-accent/30" : "text-text-muted border border-border"
                }`}
              >
                {meta.usingRealAgents ? "live agents" : "simulated"}
              </span>
            )}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            7 agents in parallel, one per site, each covering all {routeCount} {routeCount === 1 ? "route" : "routes"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-text-secondary">
            Next sweep: <span className="tabular"><Countdown targetIso={nextSweepAt} /></span>
          </p>
          <button
            onClick={onRunNow}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-soft transition-colors disabled:opacity-50"
          >
            {running ? "Running…" : "Run sweep now"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {SITES.map((site) => {
          const status = agentStatuses[site.id];
          const isRunning = running;
          const domain = new URL(site.url).hostname;
          return (
            <div
              key={site.id}
              className="bg-surface-alt rounded-lg px-2.5 py-3 flex flex-col items-center text-center gap-1.5 border border-transparent hover:border-border transition-colors"
            >
              <div className="relative">
                <SiteFavicon siteId={site.id} domain={domain} size={32} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-alt ${
                    isRunning ? "bg-warning animate-pulse" : "bg-success"
                  }`}
                />
              </div>
              <p className="text-[11px] leading-tight font-medium truncate w-full" title={site.name}>
                {site.name}
              </p>
              <p className="text-[10px] text-text-muted">
                {isRunning ? "syncing" : relativeTime(status?.lastSyncedAt ?? null)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
