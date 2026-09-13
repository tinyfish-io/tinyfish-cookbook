"use client";

import { RateListing } from "@/lib/types";
import { formatTimeAgo } from "@/lib/formatters";

export type AgentLiveState = "pending" | "running" | "done";

// One entry per bank — shows whether a real agent checked it, when, and
// how many of the 3 tracked products it actually found a rate for.
// When `agentStates` is passed (during an active sweep), the dot reflects
// live pending/running/done state instead of historical data presence —
// same component, two modes, so there's only ever one "sources" widget.
export function SourcesStrip({
  listings,
  compact = false,
  agentStates
}: {
  listings: RateListing[];
  compact?: boolean;
  agentStates?: Record<string, { name: string; state: AgentLiveState }>;
}) {
  const byBank = new Map<string, RateListing[]>();
  for (const l of listings) {
    if (!byBank.has(l.bankId)) byBank.set(l.bankId, []);
    byBank.get(l.bankId)!.push(l);
  }

  // If we have live agent states, those drive which bank ids we show and
  // their order — otherwise fall back to whatever's in the historical data.
  const bankIds = agentStates ? Object.keys(agentStates) : Array.from(byBank.keys());
  if (bankIds.length === 0) return null;

  const total = bankIds.length;
  const doneCount = agentStates
    ? Object.values(agentStates).filter((s) => s.state === "done").length
    : total;

  return (
    <div className={`glass bg-panel border border-line rounded-xl ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted">
          Sources · {total} agents in parallel{agentStates ? ` · ${doneCount}/${total}` : ""}
        </span>
        {agentStates && (
          <div className="h-1 w-20 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gold transition-all duration-300" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
        )}
      </div>
      <div className={compact ? "space-y-3" : "flex flex-wrap gap-x-8 gap-y-4"}>
        {bankIds.map((bankId) => {
          const bankListings = byBank.get(bankId) ?? [];
          const found = bankListings.filter((l) => l.ratePercent !== undefined).length;
          const hasData = found > 0;
          const checkedAt = bankListings[0]?.checkedAt;
          const liveState = agentStates?.[bankId]?.state;
          const name = agentStates?.[bankId]?.name ?? bankListings[0]?.bankName ?? bankId;

          const dotColor = liveState
            ? liveState === "done"
              ? "bg-mint"
              : liveState === "running"
              ? "bg-amber live-dot"
              : "bg-white/15"
            : hasData
            ? "bg-mint"
            : "bg-white/15";

          const timeLabel = liveState === "running" ? "checking…" : checkedAt ? formatTimeAgo(checkedAt) : "—";

          return (
            <div key={bankId} className={compact ? "flex items-center justify-between" : "text-center"}>
              {compact ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full inline-block ${dotColor}`} />
                    <span className="text-xs text-paper/80">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{timeLabel}</span>
                    {bankListings.length > 0 && (
                      <span className="text-[10px] bg-primary/20 text-gold px-1.5 py-0.5 rounded">
                        {found}/{bankListings.length}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className={`h-2.5 w-2.5 rounded-full inline-block mb-1.5 ${dotColor}`} />
                  <div className="text-xs text-paper/80">{name}</div>
                  <div className="text-[10px] text-muted mt-1">{timeLabel}</div>
                  {bankListings.length > 0 && (
                    <span className="inline-block mt-1.5 text-[10px] bg-primary/20 text-gold px-1.5 py-0.5 rounded">
                      {found}/{bankListings.length}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
