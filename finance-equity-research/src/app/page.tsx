"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { useScan, type SourceState } from "@/hooks/use-scan";

const FAMILY_ROWS = [
  { key: "sentiment", label: "Customer Sentiment", weight: "40%" },
  { key: "workforce", label: "Workforce", weight: "30%" },
  { key: "leadership", label: "Leadership", weight: "20%" },
  { key: "ops", label: "Product / Ops", weight: "10%" },
] as const;

export default function LiveScanPage() {
  const { state, start } = useScan();
  const [ticker, setTicker] = useState("");
  const counts = useMemo(() => {
    const c = { complete: 0, working: 0, queued: 0, failed: 0 };
    for (const s of state.sources) c[s.status === "failed" ? "failed" : s.status]++;
    return c;
  }, [state.sources]);

  const findings = useMemo(
    () =>
      state.sources
        .flatMap((s) => (s as SourceState & { samples?: { quote: string; source_label: string; published_at: string | null }[] }).samples ?? [])
        .slice(0, 6),
    [state.sources],
  );

  return (
    <main className="min-h-screen">
      <TopBar active="scan" />

      <form
        className="flex items-end gap-8 px-12 pb-6 pt-10 rule-hairline"
        onSubmit={(e) => {
          e.preventDefault();
          if (ticker.trim()) void start(ticker);
        }}
      >
        <div className="flex-1">
          <div className="eyebrow text-rust mb-3" style={{ letterSpacing: "0.16em", color: "var(--color-rust)" }}>
            New scan
          </div>
          <div className="flex max-w-[560px] items-baseline gap-4 border-b-2 border-ink pb-2.5">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="TICKER"
              aria-label="Ticker to scan"
              className="w-full bg-transparent font-serif text-[40px] font-medium tracking-wide outline-none placeholder:text-hairline"
            />
            <div className="whitespace-nowrap text-[13px] text-muted">
              {state.company ? `${state.company.name}` : "Enter a ticker, press return"}
            </div>
          </div>
        </div>
        <div className="text-right tnum">
          {state.phase === "running" || state.phase === "complete" ? (
            <>
              <div className="text-[13px] font-semibold">
                <span className="pulse-dot pulse-dot--fast mr-2" aria-hidden />
                {state.sources.length} agents dispatched
              </div>
              <div className="mt-1 text-xs text-muted">
                {counts.complete} complete · {counts.working} working · {counts.queued} queued
                {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">Scans run live — nothing here is cached coverage.</div>
          )}
        </div>
      </form>

      {state.phase === "error" && (
        <div className="mx-12 mt-6 border border-rust p-4 text-[13px]" style={{ borderColor: "var(--color-rust)" }}>
          The scan stopped: {state.error}. Adjust the ticker and run it again.
        </div>
      )}

      <div className="grid grid-cols-[1fr_330px] gap-11 px-12 pb-14 pt-8 max-lg:grid-cols-1">
        <div>
          <div className="mb-10 grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {state.sources.map((source) => (
              <SourceCard key={source.key} source={source} />
            ))}
            {state.sources.length === 0 && (
              <div className="card card--queued col-span-2 py-10 text-center text-[13px] text-muted">
                Pick a company to dispatch the agents — Reddit, Trustpilot, app stores, careers pages, SEC EDGAR.
              </div>
            )}
          </div>

          {findings.length > 0 && (
            <div>
              <div className="rule-ink mb-0.5 flex items-baseline gap-4 pb-2">
                <div className="eyebrow">Findings · streaming in</div>
                <div className="text-[11px] text-muted">newest first</div>
              </div>
              {findings.map((f, i) => (
                <div key={i} className="rule-hairline flex items-baseline gap-4 py-3">
                  <div className="quote flex-1" style={{ fontSize: 15.5 }}>
                    “{f.quote}”
                  </div>
                  <div className="whitespace-nowrap text-xs">
                    <span className="text-muted tnum">
                      {f.source_label}
                      {f.published_at ? ` · ${f.published_at}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside>
          <div className="card p-6">
            <div className="mb-4 flex items-baseline gap-3">
              <div className="eyebrow text-muted" style={{ letterSpacing: "0.16em" }}>
                Direction score
              </div>
              {state.phase === "running" && (
                <div className="ml-auto text-[11px] font-semibold" style={{ color: "var(--color-rust)" }}>
                  <span className="pulse-dot pulse-dot--fast mr-1.5" style={{ width: 6, height: 6 }} aria-hidden />
                  assembling
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <div className="font-serif text-[64px] font-medium leading-[0.8] tnum">{state.score ?? "—"}</div>
              {state.provisional && state.score != null && (
                <div className="text-xs leading-snug text-muted">
                  provisional
                  <br />
                  until all sources land
                </div>
              )}
            </div>
            <div className="my-3 text-xs text-muted tnum">
              {counts.complete} of {state.sources.length || "—"} sources in
            </div>
            <div className="grid gap-2.5">
              {FAMILY_ROWS.map((row) => {
                const fam = state.families[row.key];
                const pendingSources = state.sources.filter((s) => s.family === row.key && s.status !== "complete" && s.status !== "failed");
                return (
                  <div key={row.key} className="grid grid-cols-[1fr_34px] items-center gap-3">
                    <div>
                      <div className="text-[12.5px]">
                        {row.label}{" "}
                        <span className="text-muted">
                          {row.weight}
                          {pendingSources.length > 0 ? ` · ${pendingSources[0].label} pending` : ""}
                        </span>
                      </div>
                      <div className="score-track mt-1.5" style={{ height: 6 }}>
                        {fam && <div className="score-fill" style={{ width: `${fam.score}%`, opacity: pendingSources.length ? 0.45 : 1 }} />}
                      </div>
                    </div>
                    <div className="text-right text-[13px] font-semibold tnum" style={fam ? undefined : { color: "var(--color-muted)" }}>
                      {fam?.score ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card-footer" style={{ marginTop: 16, lineHeight: 1.5 }}>
              Families with no completed source are excluded; remaining weights are renormalized. Final score lands when every agent
              reports.
            </div>
          </div>
          {state.phase === "complete" && state.company && (
            <div className="mt-4 text-xs leading-relaxed text-muted">
              Scan complete — see the full{" "}
              <Link href={`/company/${state.company.ticker}`} className="text-xs">
                company read →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SourceCard({ source }: { source: SourceState & { samples?: unknown } }) {
  const cardClass =
    source.status === "working" ? "card card--working" : source.status === "queued" ? "card card--queued" : "card";
  return (
    <div className={cardClass} style={{ padding: "16px 18px" }}>
      <div className="flex items-baseline gap-2.5">
        <div className={`flex-1 text-[13.5px] font-semibold ${source.status === "queued" ? "text-muted" : ""}`}>{source.label}</div>
        {source.status === "complete" && (
          <div className="text-[11.5px] font-semibold tnum" style={{ color: "var(--color-ok)" }}>
            ✓ Complete · {((source.durationMs ?? 0) / 1000).toFixed(1)} s
          </div>
        )}
        {source.status === "failed" && (
          <div className="text-[11.5px] font-semibold" style={{ color: "var(--color-rust)" }}>
            Failed
          </div>
        )}
        {source.status === "working" && (
          <div className="text-[11.5px] font-semibold" style={{ color: "var(--color-rust)" }}>
            <span className="pulse-dot pulse-dot--fast mr-1.5" style={{ width: 6, height: 6 }} aria-hidden />
            Working
          </div>
        )}
        {source.status === "queued" && <div className="text-[11.5px] font-semibold text-muted">Queued</div>}
      </div>
      <div className="mt-1.5 text-[12.5px] text-muted tnum">
        {source.status === "working" && <em>{source.purpose ?? "dispatching browser…"}</em>}
        {source.status === "complete" && (source.note ?? `${source.itemsRead ?? 0} items read`)}
        {source.status === "failed" && `${source.error} — this source is skipped; the score renormalizes without it.`}
        {source.status === "queued" && <em>waiting for a browser…</em>}
      </div>
      {source.status === "working" && source.streamingUrl && (
        <div className="mt-1.5">
          <a href={source.streamingUrl} target="_blank" rel="noreferrer" className="text-[11.5px]">
            Watch the agent’s browser →
          </a>
        </div>
      )}
    </div>
  );
}
