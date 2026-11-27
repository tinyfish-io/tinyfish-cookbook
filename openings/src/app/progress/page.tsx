import { PHASES, type Status } from "@/lib/progress";
import PipelineRunner from "./PipelineRunner";

export const metadata = { title: "Openings · Build progress" };

const STATUS_STYLE: Record<Status, { label: string; dot: string }> = {
  done: { label: "Done", dot: "bg-ok" },
  in_progress: { label: "In progress", dot: "bg-accent animate-pulse" },
  todo: { label: "To do", dot: "bg-border" },
};

export default function ProgressPage() {
  const done = PHASES.filter((p) => p.status === "done").length;
  const pct = Math.round((done / PHASES.length) * 100);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">TinyFish bounty · Job portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Openings: build progress</h1>
        <p className="mt-2 max-w-2xl text-muted">
          A student job radar. Search discovers postings, Fetch reads them, Agent handles the portals Fetch
          can&apos;t. This page tracks the build and lets you run the pipeline against live data.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-sm tabular-nums text-muted">
            {done}/{PHASES.length} phases
          </span>
        </div>
      </header>

      <section aria-labelledby="phases" className="mb-12">
        <h2 id="phases" className="mb-4 text-lg font-semibold">Phases</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {PHASES.map((phase) => {
            const s = STATUS_STYLE[phase.status];
            return (
              <li key={phase.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">
                    <span className="font-mono text-muted">{phase.id}</span> {phase.title}
                  </h3>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                    <span className={`size-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{phase.goal}</p>
                {phase.items.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {phase.items.map((item) => (
                      <li key={item.label} className="flex gap-2">
                        <span aria-hidden className={item.done ? "text-ok" : "text-muted"}>
                          {item.done ? "✓" : "○"}
                        </span>
                        <span className={item.done ? "" : "text-muted"}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="runner">
        <h2 id="runner" className="mb-1 text-lg font-semibold">Run the pipeline</h2>
        <p className="mb-4 text-sm text-muted">Live Search + board reads → Fetch → extraction, with Firecrawl as the fallback when TinyFish comes back empty. Agent is off unless you give it a budget (it&apos;s metered).</p>
        {/* The runner's API is dev-only (no cost guard on it), so it's hidden on the deployed site. */}
        {process.env.NODE_ENV === "production" ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            The pipeline runner is a local dev tool. On the live site, use <a className="underline" href="/jobs">My radar</a>.
          </p>
        ) : (
          <PipelineRunner />
        )}
      </section>
    </main>
  );
}
