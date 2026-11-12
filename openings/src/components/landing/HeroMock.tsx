import { Panel } from "./Panel";
import { SAMPLE_JOBS, VISA_LABEL } from "./samples";

// Messages from a real deep-search scan (figma + notion watchlist, New York / Remote).
const RUN_LOG = [
  { tool: "Search", msg: "Search found 38 postings" },
  { tool: "Fetch", msg: "Boards listed 165 roles · 4 relevant" },
  { tool: "Agent", msg: "Agent listed 3 relevant roles" },
  { tool: "Fetch", msg: "Read 13/15 postings" },
  { tool: "Firecrawl", msg: "Rendered 2/2" },
  { tool: "LLM", msg: "Extracted 15 jobs" },
  { tool: "Rank", msg: "13 matches · 2 filtered out" },
];

// Where that scan's 13 matches were found.
const SOURCES = [
  { label: "Search", n: 7, color: "bg-data-violet" },
  { label: "Boards", n: 3, color: "bg-data-blue" },
  { label: "Agent", n: 3, color: "bg-data-pink" },
];

const VISA_CLS = {
  sponsors: "bg-ok/10 text-ok",
  no_sponsorship: "bg-danger/10 text-danger",
  unknown: "bg-sunken text-muted",
} as const;

function Score({ n }: { n: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[4px] border border-border font-mono text-sm font-medium tabular-nums">
      {n}
    </span>
  );
}

export function HeroMock() {
  const max = Math.max(...SOURCES.map((s) => s.n));
  return (
    <div className="relative mx-auto w-full max-w-[1120px] text-left" aria-label="Example of the Openings dashboard, from a real scan">
      <Panel
        title="My radar"
        tabs={["Radar", "Run log", "Agent"]}
        active="Radar"
        right={<span className="font-mono text-[11px] text-muted">13 matches · 176s</span>}
        className="relative z-10"
      >
        <div className="grid md:grid-cols-[230px_1fr]">
          {/* Run log rail */}
          <ol className="hidden space-y-2.5 border-r border-border bg-sunken/60 p-4 text-xs md:block">
            <li className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Last scan</li>
            {RUN_LOG.map((r) => (
              <li key={r.msg} className="flex gap-2">
                <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-ok text-[8px] text-white">✓</span>
                <span>
                  <span className="block text-foreground">{r.msg}</span>
                  <span className="font-mono text-[10px] text-muted">{r.tool}</span>
                </span>
              </li>
            ))}
          </ol>

          {/* Ranked rows */}
          <div className="divide-y divide-border">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-muted">
              <span className="rounded-[4px] border border-border bg-surface px-2 py-1 text-foreground">Software engineer internships</span>
              <span className="rounded-[4px] border border-border px-2 py-1">New York, Remote</span>
              <span className="rounded-[4px] border border-border px-2 py-1">Class of 2027</span>
              <span className="rounded-[4px] border border-border px-2 py-1">python</span>
            </div>
            {SAMPLE_JOBS.map((j) => (
              <div key={j.company + j.term} className="flex items-start gap-3 px-4 py-3.5">
                <Score n={j.score} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    <span className="font-medium text-foreground">{j.company}</span> · {j.location} · {j.workplace}
                  </p>
                  <p className="truncate text-sm font-medium">{j.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                    <span className={`inline-block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 ${VISA_CLS[j.visa]}`}>Visa: {VISA_LABEL[j.visa]}</span>
                    {j.reasons.map((r) => (
                      <span key={r} className="inline-block whitespace-nowrap rounded-[4px] bg-data-violet/10 px-1.5 py-0.5 text-highlight">
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right text-xs sm:block">
                  <p className="font-medium">{j.term ?? "—"}</p>
                  <p className="text-muted">{j.pay ?? "Pay not listed"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Floating: the Agent's live browser on Notion's Ashby board */}
      <Panel
        title="Agent · jobs.ashbyhq.com/notion"
        right={<span className="flex items-center gap-1 font-mono text-[10px] text-highlight"><span className="size-1.5 rounded-full bg-highlight" />live</span>}
        className="absolute -bottom-10 -right-14 z-20 hidden w-[300px] xl:block"
      >
        <div className="space-y-2 p-3 text-[11px]">
          <p className="font-display text-sm">Notion</p>
          <p className="text-muted">Open Positions (130)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {["Department", "Employment type", "Location", "Location type"].map((f) => (
              <span key={f} className="rounded-[4px] border border-border px-1.5 py-1 text-muted">
                {f} ▾
              </span>
            ))}
          </div>
          {["Software Engineer Intern", "Software Engineer Intern, Mobile", "Software Engineer Intern"].map((t, i) => (
            <p key={i} className={`rounded-[4px] px-1.5 py-1 ${i === 0 ? "bg-data-violet/10 text-foreground" : "text-muted"}`}>
              {t}
            </p>
          ))}
        </div>
        <p className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted">▸ Return software engineer intern job postings</p>
      </Panel>

      {/* Floating: where the matches came from */}
      <Panel className="absolute -left-14 -top-10 z-20 hidden w-[220px] p-3 xl:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Where matches came from</p>
        <div className="mt-3 space-y-2">
          {SOURCES.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-muted">{s.label}</span>
              <span className={`h-2.5 rounded-sm ${s.color}`} style={{ width: `${(s.n / max) * 100}%` }} />
              <span className="font-mono tabular-nums">{s.n}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
