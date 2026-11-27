"use client";

import { useState } from "react";
import { STATE_TILES, STATE_NAMES, STATUS_LABELS, STATUS_ORDER, type CoverageStatus } from "@/lib/states";

export type CoverageRecord = {
  state: string;
  coverage_status: CoverageStatus;
  criteria_summary: string | null;
  criteria_raw_excerpt: string | null;
  administering_entity: string | null;
  source_doc: string | null;
  source_url: string | null;
  effective_date: string | null;
  dropped_this_year: boolean;
  last_checked_at: string;
};

type SweepState = {
  phase: "idle" | "running" | "complete" | "error";
  checked: number;
  total: number;
  changed: number;
  lastNews: string | null;
  error?: string;
};

export function MapView({ records, conditionSlug }: { records: CoverageRecord[]; conditionSlug: string }) {
  const byState = new Map(records.map((r) => [r.state, r]));
  const [selected, setSelected] = useState("NC");
  const [checking, setChecking] = useState(false);
  const [freshness, setFreshness] = useState<Record<string, string>>({});
  const [liveNote, setLiveNote] = useState<string | null>(null);
  // live overrides written by the sweep stream
  const [liveStatus, setLiveStatus] = useState<Record<string, { status: CoverageStatus; dropped: boolean }>>({});
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  const [sweep, setSweep] = useState<SweepState>({ phase: "idle", checked: 0, total: 51, changed: 0, lastNews: null });

  const record = byState.get(selected);
  const statusOf = (code: string): CoverageStatus => liveStatus[code]?.status ?? byState.get(code)?.coverage_status ?? "none";
  const droppedOf = (code: string) => liveStatus[code]?.dropped ?? byState.get(code)?.dropped_this_year ?? false;

  async function checkAgain() {
    if (checking || !record) return;
    setChecking(true);
    setLiveNote(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: selected, condition: conditionSlug }),
      });
      const data = await response.json();
      if (data.ok) {
        setFreshness((f) => ({ ...f, [selected]: "Checked just now" }));
        if (data.changed) setLiveStatus((s) => ({ ...s, [selected]: { status: data.status, dropped: droppedOf(selected) } }));
        setLiveNote(data.changed ? `The policy moved since our last sweep — now: ${STATUS_LABELS[data.status as CoverageStatus]}.` : "Re-read the source — no change since the last sweep.");
      } else {
        setLiveNote(`The agent couldn't finish: ${data.error}. The record keeps its last verified state.`);
      }
    } catch {
      setLiveNote("The check didn't go through — try again in a moment.");
    } finally {
      setChecking(false);
    }
  }

  async function sweepAll() {
    if (sweep.phase === "running") return;
    setSweep({ phase: "running", checked: 0, total: 51, changed: 0, lastNews: null });
    try {
      const response = await fetch("/api/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: conditionSlug }),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "state_checked") {
            const state = event.state as string;
            setLiveStatus((s) => ({ ...s, [state]: { status: event.status as CoverageStatus, dropped: event.dropped as boolean } }));
            setFreshness((f) => ({ ...f, [state]: "Checked just now" }));
            setFlashing((f) => ({ ...f, [state]: true }));
            setTimeout(() => setFlashing((f) => ({ ...f, [state]: false })), 900);
            setSweep((s) => ({
              ...s,
              checked: event.idx as number,
              total: event.total as number,
              changed: s.changed + (event.changed ? 1 : 0),
              lastNews: (event.news as string | null) ?? s.lastNews,
            }));
          } else if (event.type === "sweep_complete") {
            setSweep((s) => ({ ...s, phase: "complete", changed: event.changed as number }));
          } else if (event.type === "sweep_error") {
            setSweep((s) => ({ ...s, phase: "error", error: event.message as string }));
          }
        }
      }
      setSweep((s) => (s.phase === "running" ? { ...s, phase: "complete" } : s));
    } catch (err) {
      setSweep((s) => ({ ...s, phase: "error", error: (err as Error).message }));
    }
  }

  return (
    <div className="flex items-start gap-9 max-lg:flex-col">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-4">
          <button className="btn-primary" style={{ padding: "10px 18px", fontSize: 14.5 }} onClick={sweepAll} disabled={sweep.phase === "running"}>
            {sweep.phase === "running" ? `Sweeping… ${sweep.checked}/${sweep.total}` : "Sweep all 51 states now"}
          </button>
          {sweep.phase === "running" && (
            <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
              one tracker read + a live search per state · {sweep.changed} change{sweep.changed === 1 ? "" : "s"} so far
            </span>
          )}
          {sweep.phase === "complete" && (
            <span className="text-sm font-semibold" style={{ color: "var(--color-heading)" }}>
              All {sweep.total} states re-checked · {sweep.changed} status change{sweep.changed === 1 ? "" : "s"}
            </span>
          )}
          {sweep.phase === "error" && (
            <span className="text-sm" style={{ color: "var(--color-drop)" }}>
              Sweep stopped: {sweep.error}
            </span>
          )}
        </div>

        <div className="grid grid-cols-11 gap-[7px]">
          {STATE_TILES.map(([code, name, row, col]) => {
            const status = statusOf(code);
            return (
              <button
                key={code}
                onClick={() => { setSelected(code); setLiveNote(null); }}
                title={`${name} — ${STATUS_LABELS[status]}`}
                className={`state-tile tile-${status} ${selected === code ? "state-tile--selected" : ""}`}
                style={{
                  gridRow: row,
                  gridColumn: col,
                  ...(flashing[code] ? { outline: "3px solid var(--color-primary)", outlineOffset: 1, transform: "translateY(-2px)" } : {}),
                }}
              >
                {code}
                {droppedOf(code) && <span className="drop-ring absolute right-[5px] top-[5px]" title="Dropped coverage this year" />}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--color-body)" }}>
          {STATUS_ORDER.map((status) => (
            <span key={status} className="flex items-center gap-2">
              <span className={`inline-block size-4 rounded-[5px] tile-${status}`} style={{ borderWidth: status === "none" ? undefined : 1 }} />
              {STATUS_LABELS[status]}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="drop-ring" style={{ width: 12, height: 12, borderWidth: 3 }} />
            Dropped coverage this year
          </span>
        </div>
        <p className="mt-5 max-w-[620px] text-[15px] leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          Most states haven&apos;t opened a pathway yet — that&apos;s the honest picture today. Click any state for the exact policy,
          in its own words, with the source it came from.
        </p>
      </div>

      <aside className="w-[440px] flex-none rounded-3xl border p-8 max-lg:w-full" style={{ background: "var(--color-card)", borderColor: "var(--color-border)", boxShadow: "0 2px 12px rgba(90,75,50,0.05)" }}>
        {record && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="h-serif text-[27px]">{STATE_NAMES[record.state]}</h2>
              <span className="chip">
                <span className="fresh-dot" aria-hidden />
                {freshness[record.state] ?? formatChecked(record.last_checked_at)}
              </span>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className={`pill pill-${statusOf(record.state)}`}>{STATUS_LABELS[statusOf(record.state)]}</span>
              {droppedOf(record.state) && <span className="pill pill-dropped">Dropped this year</span>}
            </div>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt style={{ color: "var(--color-faint)" }}>Effective</dt>
              <dd className="font-semibold">{record.effective_date ? formatDate(record.effective_date) : "— (nothing published)"}</dd>
              <dt style={{ color: "var(--color-faint)" }}>Run by</dt>
              <dd className="font-semibold">{record.administering_entity ?? `${STATE_NAMES[record.state]} Medicaid`}</dd>
              <dt style={{ color: "var(--color-faint)" }}>Source</dt>
              <dd>
                {record.source_url ? (
                  <a href={record.source_url} target="_blank" rel="noreferrer" className="font-semibold">
                    {record.source_doc ?? "Source document"} ↗
                  </a>
                ) : (
                  <span className="font-semibold">No document found in the last sweep</span>
                )}
              </dd>
            </dl>

            {record.criteria_raw_excerpt ? (
              <figure className="quote-panel mt-5">
                <div className="micro-label mb-2">What the policy says, word for word</div>
                <blockquote className="quote-text">“{record.criteria_raw_excerpt}”</blockquote>
              </figure>
            ) : (
              record.criteria_summary && (
                <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--color-body)" }}>
                  {record.criteria_summary}
                </p>
              )
            )}

            {liveNote && (
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--color-heading)" }}>
                {liveNote}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              <button className="btn-primary w-full" onClick={checkAgain} disabled={checking}>
                {checking ? "Re-reading the policy…" : "Check again now"}
              </button>
              <div className="text-center text-[13px]" style={{ color: "var(--color-faint)" }}>
                Sends a live agent to re-read the official source right now
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function formatChecked(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Checked today, ${time}` : `Checked ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
