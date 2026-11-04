"use client";

import { useState } from "react";
import type { Job } from "@/lib/job";
import type { PipelineResult } from "@/lib/pipeline";

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const VISA_LABEL: Record<Job["visa"], { text: string; cls: string }> = {
  sponsors: { text: "Sponsors", cls: "text-ok" },
  no_sponsorship: { text: "No sponsorship", cls: "text-red-600" },
  unknown: { text: "Not stated", cls: "text-muted" },
};

function Stat({ label, value, ms }: { label: string; value: string; ms?: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
      {ms !== undefined && <div className="font-mono text-xs text-muted">{(ms / 1000).toFixed(1)}s</div>}
    </div>
  );
}

export default function PipelineRunner() {
  const [role, setRole] = useState("software engineer");
  const [locations, setLocations] = useState("New York, Remote");
  const [seniority, setSeniority] = useState("internship");
  const [companies, setCompanies] = useState("figma, palantir, notion");
  const [agentRuns, setAgentRuns] = useState(0);
  const [keywords, setKeywords] = useState("python, typescript");
  const [gradYear, setGradYear] = useState("2027");
  const [needsVisa, setNeedsVisa] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          seniority,
          locations: split(locations).slice(0, 3),
          companies: split(companies).slice(0, 10),
          keywords: split(keywords).slice(0, 5),
          gradYear: gradYear ? Number(gradYear) : null,
          needsVisa,
          readLimit: 15,
          agentRuns,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const s = result?.stats;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <form onSubmit={run} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_2fr_1fr_auto] lg:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Role</span>
          <input className={input} value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Locations (max 3)</span>
          <input className={input} value={locations} onChange={(e) => setLocations(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Seniority</span>
          <select className={input} value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            <option value="internship">Internship</option>
            <option value="new_grad">New grad</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Watchlist (board slugs)</span>
          <input className={input} value={companies} onChange={(e) => setCompanies(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Agent runs (metered)</span>
          <select className={input} value={agentRuns} onChange={(e) => setAgentRuns(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Off" : n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm lg:col-span-2">
          <span className="mb-1 block text-muted">Keywords (ranking boost)</span>
          <input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Grad year</span>
          <input className={input} inputMode="numeric" value={gradYear} onChange={(e) => setGradYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <label className="flex items-center gap-2 self-center text-sm lg:col-span-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={needsVisa} onChange={(e) => setNeedsVisa(e.target.checked)} />
          I need visa sponsorship
        </label>
        <button
          type="submit"
          disabled={running}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {running ? "Running…" : "Run"}
        </button>
      </form>

      {running && (
        <p className="mt-4 text-sm text-muted">
          Searching job boards and reading watchlist boards, then reading 15 postings and extracting details. Usually 15–30s
          {agentRuns > 0 && ", plus about a minute per Agent run (two at a time)"}.
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-600">Error: {error}</p>}

      {result && s && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="① Search found" value={`${s.searchFound} postings`} ms={s.ms.search} />
            <Stat label="② Boards listed" value={`${s.boardListed} roles · ${s.boardRelevant} relevant`} ms={s.ms.boards} />
            <Stat
              label="Agent runs"
              value={s.agent.budget ? `${s.agent.runs.filter((r) => r.ok).length}/${s.agent.used} ok · budget ${s.agent.budget}` : "Off"}
              ms={s.agent.used ? s.ms.agent : undefined}
            />
            <Stat
              label="Firecrawl fallback"
              value={
                !s.firecrawl.enabled
                  ? "Not configured"
                  : s.firecrawl.searchFallbackHits || s.firecrawl.scrapeAttempts
                    ? [
                        s.firecrawl.searchFallbackHits ? `${s.firecrawl.searchFallbackHits} search hits` : null,
                        s.firecrawl.scrapeAttempts ? `rendered ${s.firecrawl.scraped}/${s.firecrawl.scrapeAttempts}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Standing by"
              }
              ms={s.firecrawl.scrapeAttempts ? s.ms.firecrawl : undefined}
            />
            <Stat label="③ Fetch read" value={`${s.read} pages${s.readFailed ? ` · ${s.readFailed} failed` : ""}`} ms={s.ms.fetch} />
            <Stat
              label="④ Extracted by"
              value={
                !s.llm
                  ? "Rules (no AI Gateway key)"
                  : s.llmDisabledReason
                    ? "Rules (LLM unavailable)"
                    : `LLM${s.llmFailed ? ` · ${s.llmFailed} fell back` : ""}`
              }
              ms={s.ms.extract}
            />
            <Stat
              label="⑤ Ranked"
              value={`${s.rank.kept} matches · ${s.rank.filtered} filtered`}
            />
          </div>

          {s.agent.runs.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs">
              {s.agent.runs.map((r) => (
                <li key={`${r.purpose}-${r.url}`} className="flex flex-wrap gap-x-2">
                  <span className={r.ok ? "text-ok" : "text-red-600"}>{r.ok ? "✓" : "✗"}</span>
                  <span className="font-mono text-muted">{r.purpose === "portal" ? "searched portal" : "read posting"}</span>
                  <span className="truncate">{r.url}</span>
                  <span className="text-muted">
                    {(r.ms / 1000).toFixed(0)}s · found {r.found}
                    {r.error ? ` · ${r.error}` : ""}
                  </span>
                  {r.runId && (
                    <a className="text-accent hover:underline" href={`https://agent.tinyfish.ai/runs/${r.runId}`} target="_blank" rel="noreferrer">
                      run ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          {s.llmDisabledReason && (
            <p className="mt-3 text-xs text-warn">LLM extraction turned off for this run: {s.llmDisabledReason}</p>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Role · why it matched</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Term / grad</th>
                  <th className="py-2 pr-3 font-medium">Pay</th>
                  <th className="py-2 pr-3 font-medium">Visa</th>
                  <th className="py-2 font-medium">Found via</th>
                </tr>
              </thead>
              <tbody>
                {result.jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3 font-mono text-base font-semibold tabular-nums text-accent">{j.score}</td>
                    <td className="py-2 pr-3">
                      <a href={j.applyUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-accent hover:underline">
                        {j.title}
                      </a>
                      <div className="text-xs text-muted">
                        {j.company ?? "Unknown company"}
                        {j.duplicates.length > 0 && ` · also posted at ${j.duplicates.length} other URL${j.duplicates.length > 1 ? "s" : ""}`}
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {j.reasons.map((r) => (
                          <li
                            key={r.text}
                            className={`rounded px-1.5 py-0.5 text-[11px] ${
                              r.kind === "plus" ? "bg-ok/10 text-ok" : r.kind === "minus" ? "bg-red-600/10 text-red-600" : "bg-border text-muted"
                            }`}
                          >
                            {r.text}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2 pr-3">
                      {j.location ?? <span className="text-muted">—</span>}
                      <div className="text-xs capitalize text-muted">{j.workplace === "unknown" ? "" : j.workplace}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {j.term ?? <span className="text-muted">—</span>}
                      {j.gradYears.length > 0 && <div className="text-xs text-muted">Grad {j.gradYears.join("/")}</div>}
                    </td>
                    <td className="py-2 pr-3">{j.pay ?? <span className="text-muted">—</span>}</td>
                    <td className={`py-2 pr-3 ${VISA_LABEL[j.visa].cls}`}>{VISA_LABEL[j.visa].text}</td>
                    <td className="py-2 font-mono text-xs text-muted">
                      {j.foundBy} · {j.ats}
                      {j.readBy !== "fetch" && <div className="text-accent">read by {j.readBy}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.filtered.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">
                {result.filtered.length} filtered out
                {s.rank.skippedBeforeRead > 0 && ` · ${s.rank.skippedBeforeRead} more skipped before reading (wrong level or location)`}
              </summary>
              <ul className="mt-2 space-y-1">
                {result.filtered.map((f) => (
                  <li key={f.applyUrl} className="flex gap-2">
                    <span className="text-red-600">✗</span>
                    <a href={f.applyUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {f.company} — {f.title}
                    </a>
                    <span className="text-muted">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
