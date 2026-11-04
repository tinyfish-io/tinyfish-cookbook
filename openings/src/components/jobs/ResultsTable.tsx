"use client";

import { useState } from "react";
import type { RankedJob } from "@/lib/rank";

const VISA = {
  sponsors: { text: "Sponsors", cls: "bg-ok/10 text-ok" },
  no_sponsorship: { text: "No sponsorship", cls: "bg-danger/10 text-danger" },
  unknown: { text: "Not stated", cls: "bg-sunken text-muted" },
} as const;

const FOUND = { search: "Search", board: "Board", agent: "Agent" } as const;
const FOUND_DOT = { search: "bg-data-violet", board: "bg-data-blue", agent: "bg-data-pink" } as const;
const READ = { fetch: "TinyFish Fetch", firecrawl: "Firecrawl", agent: "TinyFish Agent" } as const;
const WORKPLACE = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: null } as const;

// One grid template for header + rows so columns line up (md and up); rows stack on phones.
const COLS = "md:grid md:grid-cols-[52px_minmax(0,2.6fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_112px_84px_28px] md:items-center md:gap-4";

function Score({ n }: { n: number }) {
  return (
    <span className="relative grid size-9 place-items-center" aria-label={`Match score ${n} of 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--data-violet)" strokeWidth="2.5" strokeDasharray={`${(n / 100) * 94.2} 94.2`} />
      </svg>
      <span className="font-mono text-xs font-medium tabular-nums">{n}</span>
    </span>
  );
}

export function ResultsTable({ jobs, isNew }: { jobs: RankedJob[]; isNew?: (id: string) => boolean }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="panel-shadow overflow-hidden rounded-[10px] border border-border bg-surface">
      <div className={`hidden border-b border-border bg-sunken px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted ${COLS}`}>
        <span>Score</span>
        <span>Role</span>
        <span>Location</span>
        <span>Term · class</span>
        <span>Pay</span>
        <span>Visa</span>
        <span>Found by</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {jobs.map((j) => {
          const expanded = open === j.id;
          const where = [j.location, WORKPLACE[j.workplace]].filter(Boolean).join(" · ");
          return (
            <li key={j.id} className={expanded ? "bg-sunken/50" : "transition-colors hover:bg-sunken/40"}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : j.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(expanded ? null : j.id);
                  }
                }}
                className={`flex cursor-pointer gap-3 px-4 py-3.5 text-sm ${COLS}`}
              >
                <Score n={j.score} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="font-medium text-foreground">{j.company ?? "Unknown company"}</span>
                    {j.onWatchlist && <span className="rounded-[4px] bg-accent/8 px-1.5 py-px text-[10px] font-medium text-accent">Watchlist</span>}
                    {isNew?.(j.id) && <span className="rounded-[4px] bg-highlight px-1.5 py-px text-[10px] font-medium text-white">New</span>}
                  </p>
                  <p className="truncate font-medium">{j.title}</p>
                  {/* Phone layout: the other columns collapse into one meta line. */}
                  <p className="mt-1 text-xs text-muted md:hidden">
                    {[where, j.term, j.pay].filter(Boolean).join(" · ")}
                  </p>
                  <span className={`mt-1.5 inline-block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[11px] md:hidden ${VISA[j.visa].cls}`}>Visa: {VISA[j.visa].text}</span>
                </div>
                <span className="hidden text-muted md:line-clamp-2" title={where}>
                  {where || "—"}
                </span>
                <span className="hidden md:block">
                  <span className="block truncate">{j.term ?? "—"}</span>
                  {j.gradYears.length > 0 && <span className="block text-xs text-muted">Class of {j.gradYears.join("/")}</span>}
                </span>
                <span className="hidden text-muted md:line-clamp-2" title={j.pay ?? undefined}>
                  {j.pay ?? "—"}
                </span>
                <span className="hidden md:block">
                  <span className={`inline-block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[11px] ${VISA[j.visa].cls}`}>{VISA[j.visa].text}</span>
                </span>
                <span className="hidden items-center gap-1.5 font-mono text-[11px] text-muted md:flex">
                  <span className={`size-1.5 rounded-full ${FOUND_DOT[j.foundBy]}`} />
                  {FOUND[j.foundBy]}
                </span>
                <span aria-hidden className={`hidden text-muted transition-transform md:block ${expanded ? "rotate-180" : ""}`}>
                  ⌄
                </span>
              </div>

              {expanded && (
                <div className="grid gap-5 border-t border-dashed border-border px-4 py-4 text-sm md:grid-cols-[52px_1fr_auto] md:gap-4">
                  <span className="hidden md:block" />
                  <div className="min-w-0">
                    {j.summary && <p className="max-w-3xl leading-relaxed text-foreground">{j.summary}</p>}
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Why it matched</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {j.reasons.map((r) => (
                        <li
                          key={r.text}
                          className={`rounded-[4px] px-2 py-1 text-xs ${
                            r.kind === "plus" ? "bg-data-violet/10 text-highlight" : r.kind === "minus" ? "bg-danger/10 text-danger" : "bg-sunken text-muted"
                          }`}
                        >
                          {r.kind === "plus" ? "✓ " : r.kind === "minus" ? "! " : ""}
                          {r.text}
                        </li>
                      ))}
                    </ul>
                    {j.skills.length > 0 && (
                      <>
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Skills asked for</p>
                        <p className="mt-1.5 text-muted">{j.skills.join(" · ")}</p>
                      </>
                    )}
                    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                      <span>found · {j.foundBy === "board" ? "company board" : `TinyFish ${FOUND[j.foundBy]}`}</span>
                      <span>read · {READ[j.readBy]}</span>
                      <span>parsed · {j.extractedBy === "llm" ? "rules + LLM" : "rules"}</span>
                      <span>{j.ats}</span>
                      {j.duplicates.length > 0 && <span>+{j.duplicates.length} duplicate{j.duplicates.length > 1 ? "s" : ""} merged</span>}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <a
                      href={j.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
                    >
                      Apply ↗
                    </a>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {jobs.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted">No matches with these filters.</p>}
    </div>
  );
}
