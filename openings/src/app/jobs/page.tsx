"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand } from "@/components/Brand";
import { ResultsTable } from "@/components/jobs/ResultsTable";
import { RunPanel } from "@/components/jobs/RunPanel";
import type { PipelineResult, PipelineStats, Stage } from "@/lib/pipeline";
import type { RankedJob } from "@/lib/rank";
import { isStale, markNew } from "@/lib/freshness";
import {
  loadPasscode,
  loadSeen,
  saveLastRun,
  savePasscode,
  savePrefs,
  saveSeen,
  toRunRequest,
  useLastRun,
  useSavedPrefs,
  type LastRun,
  type StoredPrefs,
} from "@/lib/prefs";
import { STAGE_ORDER, useRun, type LiveAgent, type StageState } from "@/lib/useRun";

type Tab = "matches" | "runlog" | "filtered";
type Workplace = "any" | "remote" | "hybrid" | "onsite";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Rebuild the run log for a saved scan (the live event stream is gone after a reload). */
function stagesFromStats(st: PipelineStats): Record<Stage, StageState> {
  const done = (message: string): StageState => ({ status: "done", message, at: null });
  const out = Object.fromEntries(STAGE_ORDER.map((s) => [s, { status: "pending", message: "", at: null }])) as Record<Stage, StageState>;
  out.search = done(`Search found ${st.searchFound} postings`);
  if (st.boardListed) out.boards = done(`Boards listed ${st.boardListed} roles, ${st.boardRelevant} relevant`);
  if (st.agent.used) out.agent = done(`${st.agent.runs.filter((r) => r.ok).length}/${st.agent.used} agent runs succeeded`);
  out.fetch = done(`Read ${st.read} postings${st.readFailed ? ` · ${st.readFailed} unreadable` : ""}`);
  if (st.firecrawl.scrapeAttempts) out.firecrawl = done(`Firecrawl rendered ${st.firecrawl.scraped}/${st.firecrawl.scrapeAttempts}`);
  out.extract = done(`Extracted ${st.rank.extracted} jobs with ${st.llm ? "rules + LLM" : "rules"}`);
  out.rank = done(`${st.rank.kept} matches · ${st.rank.filtered} filtered out`);
  return out;
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Jobs />
    </Suspense>
  );
}

function Jobs() {
  const saved = useSavedPrefs();
  if (saved === undefined) return <div className="flex-1" />;
  if (saved === null) return <NoPrefs />;
  return <Dashboard prefs={saved} />;
}

function NoPrefs() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center px-4 sm:px-6">
          <Brand />
        </div>
      </header>
      <main className="grid flex-1 place-items-center px-4 pb-24 text-center">
        <div>
          <h1 className="font-display text-4xl">
            Your radar isn&apos;t <em>set up</em> yet.
          </h1>
          <p className="mt-4 text-muted">Four quick questions and it starts scanning.</p>
          <Link href="/onboarding" className="mt-8 inline-flex bg-accent px-5 py-3 text-sm font-medium text-accent-ink hover:opacity-90">
            Set up my radar
          </Link>
        </div>
      </main>
    </div>
  );
}

function PrefRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <p className={eyebrow}>{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

function Dashboard({ prefs: initialPrefs }: { prefs: StoredPrefs }) {
  const router = useRouter();
  const params = useSearchParams();
  const lastRun = useLastRun();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [session, setSession] = useState<LastRun | null>(null);
  const [tab, setTab] = useState<Tab>("matches");

  const onResult = useCallback(
    (result: PipelineResult) => {
      const at = new Date().toISOString();
      const prev = session ?? lastRun ?? null;
      let seen = loadSeen();
      // A scan saved before this browser kept a history still counts as "seen".
      if (Object.keys(seen).length === 0 && prev) seen = markNew({}, prev.result.jobs.map((j) => j.id), prev.at).seen;
      const marked = markNew(seen, result.jobs.map((j) => j.id), at);
      saveSeen(marked.seen);
      const run: LastRun = { at, prefs, result, newIds: marked.newIds, previousAt: prev?.at ?? null };
      setSession(run);
      saveLastRun(run);
      setTab("matches");
    },
    [prefs, session, lastRun],
  );
  const run = useRun(onResult);
  const shown = session ?? lastRun ?? null;
  const running = run.status === "running";

  const scan = useCallback(
    (override?: Partial<StoredPrefs>) => {
      setTab("runlog");
      void run.start({ ...toRunRequest({ ...prefs, ...override }), passcode: loadPasscode() ?? undefined });
    },
    [prefs, run],
  );
  const [passcode, setPasscode] = useState("");

  // Arriving from onboarding (?run=1): start the first scan straight away, once.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (params.get("run") === "1" && !autoStarted.current) {
      autoStarted.current = true;
      router.replace("/jobs");
      scan();
    }
  }, [params, router, scan]);

  const toggleDeep = () => {
    const next = { ...prefs, deepSearch: !prefs.deepSearch };
    setPrefs(next);
    savePrefs(next);
  };
  const unlockAndScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    savePasscode(passcode.trim());
    setPasscode("");
    scan();
  };

  // ——— Filters ———
  const [q, setQ] = useState("");
  const [workplace, setWorkplace] = useState<Workplace>("any");
  const [sponsorsOnly, setSponsorsOnly] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const all = useMemo(() => shown?.result.jobs ?? [], [shown]);
  const newSet = useMemo(() => new Set(shown?.newIds ?? []), [shown]);
  const jobs = useMemo<RankedJob[]>(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (j) =>
        (!needle || [j.title, j.company, j.location, ...j.skills].join(" ").toLowerCase().includes(needle)) &&
        (workplace === "any" || j.workplace === workplace) &&
        (!sponsorsOnly || j.visa === "sponsors") &&
        (!watchlistOnly || j.onWatchlist) &&
        (!newOnly || newSet.has(j.id)),
    );
  }, [all, q, workplace, sponsorsOnly, watchlistOnly, newOnly, newSet]);

  const stats = shown?.result.stats;
  const filtered = shown?.result.filtered ?? [];
  const sources = (["search", "board", "agent"] as const).map((k) => ({ k, n: all.filter((j) => j.foundBy === k).length }));
  const maxSource = Math.max(1, ...sources.map((s) => s.n));

  // Run log: live while scanning; otherwise rebuilt from the saved scan.
  const logStages = running || run.status === "error" || !stats ? run.stages : stagesFromStats(stats);
  const logAgents: LiveAgent[] =
    running || !stats
      ? run.agents
      : stats.agent.runs.map((r) => ({ url: r.url, purpose: r.purpose, streamingUrl: null, lastStep: null, log: r }));

  const level = { internship: "Internships / co-ops", new_grad: "New grad", any: "Any level" }[prefs.seniority];
  const TABS: { id: Tab; label: string; count?: number; fresh?: number }[] = [
    { id: "matches", label: "Matches", count: all.length, fresh: newSet.size },
    { id: "runlog", label: "Run log" },
    { id: "filtered", label: "Filtered out", count: filtered.length },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* ——— App bar ——— */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Brand />
          <span className="hidden text-border sm:inline" aria-hidden>
            /
          </span>
          <span className="hidden truncate text-sm font-medium sm:inline">My radar</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={prefs.deepSearch}
              onClick={toggleDeep}
              disabled={running}
              title="Send an agent to careers sites that only work in a real browser. Adds 1–3 minutes; uses paid credits."
              className="flex items-center gap-2 rounded-[4px] border border-border px-2.5 py-1.5 text-sm disabled:opacity-50"
            >
              <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${prefs.deepSearch ? "bg-highlight" : "bg-border"}`}>
                <span className={`size-3 rounded-full bg-surface shadow transition-transform ${prefs.deepSearch ? "translate-x-3" : ""}`} />
              </span>
              <span className="hidden sm:inline">Deep search</span>
            </button>
            <button
              type="button"
              onClick={() => scan()}
              disabled={running}
              className="bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {running ? "Scanning…" : shown ? "Scan again" : "Run first scan"}
            </button>
          </div>
        </div>
        {/* Tabs */}
        <nav className="mx-auto flex w-full max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Radar views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                tab === t.id ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.id === "runlog" && running && (
                <span className="size-1.5 rounded-full bg-highlight motion-safe-anim" style={{ animation: "pulse-dot 1s ease-in-out infinite" }} />
              )}
              {t.label}
              {t.count !== undefined && <span className="rounded-[4px] bg-sunken px-1.5 font-mono text-[11px] text-muted">{t.count}</span>}
              {!!t.fresh && <span className="rounded-[4px] bg-highlight px-1.5 font-mono text-[11px] text-white">+{t.fresh} new</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* ——— Sidebar ——— */}
        <aside className="border-b border-border bg-surface px-4 py-6 sm:px-6 lg:border-b-0 lg:border-r lg:px-5">
          <div className="flex items-center justify-between">
            <p className={eyebrow}>Looking for</p>
            <Link href="/onboarding" className="text-xs font-medium text-accent hover:underline">
              Edit
            </Link>
          </div>
          <dl className="mt-2 divide-y divide-border">
            <PrefRow k="Role" v={<span className="capitalize">{prefs.role}</span>} />
            <PrefRow k="Level" v={level} />
            <PrefRow k="Where" v={prefs.locations.length ? prefs.locations.join(", ") : "Anywhere"} />
            <PrefRow k="Class of" v={prefs.gradYear ?? "—"} />
            <PrefRow k="Visa" v={prefs.needsVisa ? "Needs sponsorship" : "Not needed"} />
            <PrefRow k="Boosting" v={prefs.keywords.length ? prefs.keywords.join(", ") : "—"} />
            <PrefRow k="Watching" v={prefs.companies.length ? prefs.companies.join(", ") : "—"} />
          </dl>

          {stats && (
            <>
              <p className={`${eyebrow} mt-8`}>Where matches came from</p>
              <div className="mt-3 space-y-2">
                {sources.map((s) => (
                  <div key={s.k} className="grid grid-cols-[52px_1fr_20px] items-center gap-2 text-xs">
                    <span className="capitalize text-muted">{s.k}</span>
                    <span className="h-2 rounded-sm bg-sunken">
                      <span
                        className={`block h-2 rounded-sm ${s.k === "search" ? "bg-data-violet" : s.k === "board" ? "bg-data-blue" : "bg-data-pink"}`}
                        style={{ width: `${(s.n / maxSource) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-mono tabular-nums">{s.n}</span>
                  </div>
                ))}
              </div>

              <p className={`${eyebrow} mt-8`}>This scan</p>
              <dl className="mt-2 space-y-1.5 font-mono text-xs">
                {[
                  ["Postings found", stats.searchFound + stats.boardRelevant],
                  ["Skipped before reading", stats.rank.skippedBeforeRead],
                  ["Read in full", stats.read],
                  ["Duplicates merged", stats.rank.extracted - stats.rank.unique],
                  ["Agent runs", stats.agent.used],
                  ["Firecrawl rescues", stats.firecrawl.scraped],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">Scanned {timeAgo(shown!.at)}</p>
            </>
          )}
        </aside>

        {/* ——— Main ——— */}
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {run.status === "error" && run.errorCode === "deep_search_locked" ? (
            <div role="alert" className="mb-6 rounded-[4px] border border-border bg-surface px-4 py-4 text-sm">
              <p className="font-medium">Deep search is locked on this deployment</p>
              <p className="mt-1 text-muted">It spends paid agent credits, so it needs a passcode. Or scan with Search + Fetch only — that&apos;s free.</p>
              <form onSubmit={unlockAndScan} className="mt-3 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="passcode">
                  Deep search passcode
                </label>
                <input
                  id="passcode"
                  type="password"
                  autoComplete="off"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Passcode"
                  className="rounded-[7px] border border-border bg-surface px-3 py-2 outline-none focus:border-highlight focus:ring-2 focus:ring-highlight/20"
                />
                <button type="submit" className="bg-accent px-4 py-2 font-medium text-accent-ink hover:opacity-90">
                  Unlock &amp; scan
                </button>
                <button type="button" onClick={() => scan({ deepSearch: false })} className="rounded-[4px] border border-border px-4 py-2 hover:border-foreground/40">
                  Scan without deep search
                </button>
              </form>
            </div>
          ) : run.status === "error" ? (
            <p role="alert" className="mb-6 rounded-[4px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
              The scan didn&apos;t finish: {run.error}
            </p>
          ) : null}

          {tab === "runlog" && <RunPanel status={run.status} stages={logStages} agents={logAgents} startedAt={run.startedAt} />}

          {tab === "matches" &&
            (!shown ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface px-6 py-20 text-center">
                <p className="font-display text-2xl">
                  Nothing on the <em>radar</em> yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Run a scan — usually 20–40 seconds{prefs.deepSearch && ", plus 1–3 minutes for deep search"}. You can watch it in the Run log.
                </p>
                <button type="button" onClick={() => scan()} disabled={running} className="mt-6 bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-60">
                  {running ? "Scanning…" : "Run first scan"}
                </button>
              </div>
            ) : (
              <div className={running ? "opacity-60" : ""}>
                {!running && isStale(shown.at) && (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
                    <span>
                      These results are from <strong className="font-medium">{timeAgo(shown.at)}</strong> — postings open and close daily.
                    </span>
                    <button type="button" onClick={() => scan()} className="bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90">
                      Scan again
                    </button>
                  </div>
                )}
                {/* KPI tiles */}
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border lg:grid-cols-4">
                  <Kpi label="Matches" value={all.length} note="ranked best first" />
                  <Kpi label="Sponsor visas" value={all.filter((j) => j.visa === "sponsors").length} note={`${all.filter((j) => j.visa === "unknown").length} don't say`} />
                  <Kpi
                    label="Your class year"
                    value={prefs.gradYear ? all.filter((j) => j.gradYears.includes(prefs.gradYear!)).length : "—"}
                    note={prefs.gradYear ? `ask for ${prefs.gradYear} grads` : "add it in preferences"}
                  />
                  <Kpi
                    label="New since last scan"
                    value={shown.previousAt ? newSet.size : "—"}
                    note={shown.previousAt ? `last scan ${timeAgo(shown.previousAt)}` : "first scan — the next one compares"}
                  />
                </div>

                {/* Toolbar */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <label className="min-w-[14rem] flex-1">
                    <span className="sr-only">Filter matches</span>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Filter by company, title, skill…"
                      className="w-full rounded-[7px] border border-border bg-surface px-3.5 py-2 text-sm outline-none focus:border-highlight focus:ring-2 focus:ring-highlight/20"
                    />
                  </label>
                  <div role="radiogroup" aria-label="Workplace" className="flex rounded-[4px] border border-border bg-surface p-0.5 text-sm">
                    {(["any", "remote", "hybrid", "onsite"] as Workplace[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        role="radio"
                        aria-checked={workplace === w}
                        onClick={() => setWorkplace(w)}
                        className={`rounded-[3px] px-3 py-1.5 capitalize ${workplace === w ? "bg-sunken font-medium text-foreground" : "text-muted hover:text-foreground"}`}
                      >
                        {w === "any" ? "All" : w === "onsite" ? "On-site" : w}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-pressed={sponsorsOnly}
                    onClick={() => setSponsorsOnly(!sponsorsOnly)}
                    className={`rounded-[4px] border px-3 py-2 text-sm ${sponsorsOnly ? "border-ok bg-ok/10 text-ok" : "border-border bg-surface text-muted hover:text-foreground"}`}
                  >
                    Sponsors visas
                  </button>
                  {newSet.size > 0 && (
                    <button
                      type="button"
                      aria-pressed={newOnly}
                      onClick={() => setNewOnly(!newOnly)}
                      className={`rounded-[4px] border px-3 py-2 text-sm ${newOnly ? "border-highlight bg-highlight/10 text-highlight" : "border-border bg-surface text-muted hover:text-foreground"}`}
                    >
                      New only
                    </button>
                  )}
                  {prefs.companies.length > 0 && (
                    <button
                      type="button"
                      aria-pressed={watchlistOnly}
                      onClick={() => setWatchlistOnly(!watchlistOnly)}
                      className={`rounded-[4px] border px-3 py-2 text-sm ${watchlistOnly ? "border-accent bg-accent/8 text-accent" : "border-border bg-surface text-muted hover:text-foreground"}`}
                    >
                      Watchlist
                    </button>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-muted">
                    {jobs.length === all.length ? `${all.length} rows` : `${jobs.length} of ${all.length}`} · click a row for details
                  </span>
                </div>

                <div className="mt-4">
                  <ResultsTable jobs={jobs} isNew={(id) => newSet.has(id)} />
                </div>
              </div>
            ))}

          {tab === "filtered" && (
            <div className="panel-shadow overflow-hidden rounded-[10px] border border-border bg-surface">
              <div className="border-b border-border bg-sunken px-4 py-2.5">
                <p className={eyebrow}>Taken off your list — and why</p>
              </div>
              {filtered.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted">Nothing was filtered out on this scan.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((f) => (
                    <li key={f.applyUrl} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-4">
                      <a href={f.applyUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-accent">
                        <span className="font-medium">{f.company}</span> — {f.title}
                      </a>
                      <span className="text-muted">{f.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              {stats && stats.rank.skippedBeforeRead > 0 && (
                <p className="border-t border-border px-4 py-3 font-mono text-[11px] text-muted">
                  + {stats.rank.skippedBeforeRead} more skipped before reading (clearly the wrong level or city)
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
