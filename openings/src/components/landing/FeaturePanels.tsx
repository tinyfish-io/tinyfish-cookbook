import { Panel } from "./Panel";

const ATS_DOT: Record<string, string> = {
  greenhouse: "bg-data-teal",
  lever: "bg-data-blue",
  ashby: "bg-data-violet",
  workday: "bg-data-amber",
};

// Real TinyFish Search results for this query (Phase 0/1 spike runs).
const SEARCH_RESULTS = [
  { title: "Software Engineering Intern", company: "Auctor", ats: "ashby" },
  { title: "Software Engineering Internship (C++ or Python)", company: "Wehrtyou", ats: "greenhouse" },
  { title: "Software Engineer, Internship", company: "Palantir", ats: "lever" },
  { title: "Software Engineer Intern (Summer 2027)", company: "Notion", ats: "ashby" },
  { title: "Summer 2027 Software Engineering Intern", company: "PDT Partners", ats: "greenhouse" },
];

export function SearchPanel() {
  return (
    <Panel title="TinyFish Search" right={<span className="font-mono text-[10px] text-muted">38 results · 2.4s</span>}>
      <div className="border-b border-border px-4 py-3">
        <p className="rounded-[4px] border border-border bg-sunken px-3 py-2 font-mono text-xs">
          software engineer intern New York<span className="text-muted"> · site: greenhouse, lever, ashby, workday</span>
        </p>
      </div>
      <ul className="divide-y divide-border text-sm">
        {SEARCH_RESULTS.map((r) => (
          <li key={r.title + r.company} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`size-2 shrink-0 rounded-full ${ATS_DOT[r.ats]}`} />
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <span className="shrink-0 text-xs text-muted">{r.company}</span>
            <span className="hidden w-20 shrink-0 text-right font-mono text-[10px] text-muted sm:inline">{r.ats}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function BoardPanel() {
  return (
    <Panel title="boards-api.greenhouse.io/v1/boards/roblox/jobs" right={<span className="font-mono text-[10px] text-muted">230 roles · 1 call</span>}>
      <table className="w-full text-left text-sm">
        <thead className="bg-sunken font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-4 py-2 font-normal">Role</th>
            <th className="px-4 py-2 font-normal">Location</th>
            <th className="whitespace-nowrap px-4 py-2 font-normal">Kept?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <td className="px-4 py-2.5">Summer 2027 Software Engineer Intern</td>
            <td className="px-4 py-2.5 text-muted">San Mateo, CA</td>
            <td className="px-4 py-2.5">
              <span className="inline-block whitespace-nowrap rounded-[4px] bg-ok/10 px-1.5 py-0.5 text-xs text-ok">Read in full</span>
            </td>
          </tr>
          <tr className="text-muted">
            <td className="px-4 py-2.5 line-through decoration-border">[2026] Senior Machine Learning Engineer, Recommendation Systems</td>
            <td className="px-4 py-2.5">San Mateo, CA</td>
            <td className="px-4 py-2.5">
              <span className="inline-block whitespace-nowrap rounded-[4px] bg-sunken px-1.5 py-0.5 text-xs">Wrong level</span>
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="px-4 py-2.5 font-mono text-[11px] text-muted">
              …every other role checked against your level and role before a single page is read
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

export function AgentPanel() {
  return (
    <Panel title="Agent · jobs.ashbyhq.com/notion" right={<span className="font-mono text-[10px] text-highlight">deep search</span>}>
      <ol className="space-y-3 p-4 text-sm">
        {[
          // The two steps shown in the Agent's live view during a real run.
          { step: "Navigate to Notion careers site" },
          { step: "Return software engineer intern job postings" },
        ].map((s, i) => (
          <li key={s.step} className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-[10px] text-white">{i + 1}</span>
            <span>{s.step}</span>
          </li>
        ))}
      </ol>
      <div className="border-t border-border bg-sunken px-4 py-3 font-mono text-[11px] text-muted">
        → 3 relevant roles · 67–145s per run · budget: 2 runs
      </div>
    </Panel>
  );
}
