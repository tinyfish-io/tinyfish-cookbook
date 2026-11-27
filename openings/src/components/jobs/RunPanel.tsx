"use client";

import { useEffect, useState } from "react";
import type { Stage } from "@/lib/pipeline";
import { STAGE_ORDER, type LiveAgent, type RunStatus, type StageState } from "@/lib/useRun";

const STAGE_LABEL: Record<Stage, { title: string; tool: string }> = {
  search: { title: "Searching job boards", tool: "TinyFish Search" },
  boards: { title: "Reading your watchlist's boards", tool: "TinyFish Fetch" },
  agent: { title: "Agent on careers portals", tool: "TinyFish Agent" },
  fetch: { title: "Reading postings", tool: "TinyFish Fetch" },
  firecrawl: { title: "Rendering stubborn pages", tool: "Firecrawl fallback" },
  extract: { title: "Pulling out the details", tool: "Rules + LLM" },
  rank: { title: "Ranking for you", tool: "Openings" },
};

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return u.host + u.pathname;
  } catch {
    return url;
  }
}

function AgentWindow({ agent }: { agent: LiveAgent }) {
  const host = hostOf(agent.url);
  const done = agent.log !== null;
  return (
    <figure className="panel-shadow overflow-hidden rounded-[10px] border border-border bg-surface">
      <figcaption className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
        </span>
        <span className="truncate font-medium">Agent · {host}</span>
        <span className={`ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] ${done ? (agent.log!.ok ? "text-ok" : "text-danger") : "text-highlight"}`}>
          {!done && <span className="size-1.5 rounded-full bg-highlight motion-safe-anim" style={{ animation: "pulse-dot 1s ease-in-out infinite" }} />}
          {done ? (agent.log!.ok ? `done · found ${agent.log!.found}` : "couldn't finish") : "live"}
        </span>
      </figcaption>
      <div className="relative aspect-[16/10] bg-sunken">
        {agent.streamingUrl && !done ? (
          <iframe src={agent.streamingUrl} title={`Live view of the agent browsing ${host}`} className="absolute inset-0 size-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">
            {done ? (agent.log!.ok ? "Agent finished — its postings are in Matches." : agent.log!.error ?? "Agent stopped.") : "Starting a browser…"}
          </div>
        )}
      </div>
      <p className="truncate border-t border-border px-3 py-2 font-mono text-[11px] text-muted">
        {agent.lastStep && !done
          ? `▸ ${agent.lastStep}`
          : agent.purpose === "portal"
            ? done ? "Searched the careers portal" : "Searching the careers portal"
            : done ? "Read a posting Fetch couldn't render" : "Reading a posting Fetch couldn't render"}
      </p>
    </figure>
  );
}

/** Seconds since the scan started, ticking every second. */
function useSecondsSince(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

export function RunPanel({
  status,
  stages,
  agents,
  startedAt,
}: {
  status: RunStatus;
  stages: Record<Stage, StageState>;
  agents: LiveAgent[];
  startedAt: number | null;
}) {
  const seconds = useSecondsSince(status === "running" ? startedAt : null);
  // Only show stages this run touched (boards / agent / firecrawl are conditional).
  const visible = STAGE_ORDER.filter((s) => stages[s].status !== "pending" || ["search", "fetch", "extract", "rank"].includes(s));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section aria-live="polite" className="panel-shadow overflow-hidden rounded-[10px] border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {status === "running" ? "Scanning the web" : "Last scan"}
          </p>
          {status === "running" && <span className="font-mono text-[11px] tabular-nums text-muted">{seconds}s</span>}
        </div>
        <ol className="divide-y divide-border">
          {visible.map((s) => {
            const st = stages[s];
            return (
              <li key={s} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center" aria-hidden>
                  {st.status === "done" ? (
                    <span className="grid size-5 place-items-center rounded-full bg-ok text-[10px] text-white">✓</span>
                  ) : st.status === "active" ? (
                    <span className="size-2.5 rounded-full bg-highlight motion-safe-anim" style={{ animation: "pulse-dot 1s ease-in-out infinite" }} />
                  ) : (
                    <span className="size-2.5 rounded-full border border-border" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`flex flex-wrap items-baseline justify-between gap-x-3 text-sm ${st.status === "pending" ? "text-muted" : "font-medium"}`}>
                    {STAGE_LABEL[s].title}
                    <span className="font-mono text-[10px] font-normal text-muted">{STAGE_LABEL[s].tool}</span>
                  </p>
                  {st.message && <p className="mt-0.5 text-xs text-muted">{st.message}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="The agent's browser" className="space-y-4">
        {agents.length > 0 ? (
          agents.map((a) => <AgentWindow key={a.url} agent={a} />)
        ) : (
          <div className="grid h-full min-h-48 place-items-center rounded-[10px] border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted">
            <div>
              <p className="font-medium text-foreground">No agent on this scan</p>
              <p className="mt-1 max-w-sm">
                Turn on deep search to send an agent to careers sites that only work in a real browser. You&apos;ll watch it here, live.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
