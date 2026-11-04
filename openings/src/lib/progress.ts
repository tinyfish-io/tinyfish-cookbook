// Build-progress data shown on /progress. Update as phases land.

export type Status = "done" | "in_progress" | "todo";

export interface Phase {
  id: number;
  title: string;
  status: Status;
  goal: string;
  items: { label: string; done: boolean }[];
}

export const PHASES: Phase[] = [
  {
    id: 0,
    title: "Scaffold + spike",
    status: "done",
    goal: "Prove Search, Fetch and Agent work on real job data before building anything.",
    items: [
      { label: "Next.js app + TinyFish SDK", done: true },
      { label: "Search finds postings on Greenhouse / Lever / Ashby / Workday", done: true },
      { label: "Fetch reads posting pages in batches of 10", done: true },
      { label: "Agent searches a Workday portal and returns JSON", done: true },
      { label: "npm run spike script", done: true },
    ],
  },
  {
    id: 1,
    title: "Pipeline: structured jobs",
    status: "done",
    goal: "Turn raw pages into clean Job records and read whole company boards.",
    items: [
      { label: "Job schema (zod)", done: true },
      { label: "Rule-based extraction: location, remote, pay, visa, term, grad year (tested)", done: true },
      { label: "Watchlist boards: Greenhouse feed + Lever board via Fetch", done: true },
      { label: "Fair read budget: boards ≤ half, round-robin per company", done: true },
      { label: "LLM extraction via AI Gateway (openai/gpt-4.1-mini, free-tier OK)", done: true },
    ],
  },
  {
    id: 2,
    title: "Agent escalation",
    status: "done",
    goal: "Send JS-app portals (Workday, Ashby boards) to Agent, with a budget.",
    items: [
      { label: "Search finds a company's Ashby/Workday portal (free)", done: true },
      { label: "Agent searches that portal and lists postings", done: true },
      { label: "Pages Fetch can't render (<600 chars) are read by Agent", done: true },
      { label: "Per-run budget, 2 in flight, 150s timeout, live-view URL captured", done: true },
      { label: "LLM extraction batched 5 per call (free tier: 5 req/min)", done: true },
      { label: "Firecrawl fallback: search + render before Agent; survives a TinyFish outage", done: true },
    ],
  },
  {
    id: 3,
    title: "Dedupe + rank",
    status: "done",
    goal: "One entry per job, filtered and ranked with a 'why it matched'.",
    items: [
      { label: "Dedupe by URL, then company + title + location + term (keeps the fullest copy)", done: true },
      { label: "Skip before reading: clearly-senior titles, board postings in other locations", done: true },
      { label: "Hard filters with reasons: level, location (aliases), visa refusals, grad year", done: true },
      { label: "0–100 score with 'why it matched' chips; keywords, grad year, visa, watchlist", done: true },
    ],
  },
  {
    id: 4,
    title: "The real app",
    status: "done",
    goal: "A proper product: landing page with hero, onboarding for preferences, and a jobs dashboard.",
    items: [
      { label: "Landing page: radar-sweep hero, how it works, posting specimen, light + dark", done: true },
      { label: "4-step onboarding saved in this browser (no account)", done: true },
      { label: "Streaming /api/run: stage-by-stage progress as NDJSON", done: true },
      { label: "Jobs dashboard: live run timeline, Agent's live browser, filters, ranked cards", done: true },
      { label: "Checked at 375px, light + dark, small-text contrast ≥4.5:1", done: true },
    ],
  },
  {
    id: 5,
    title: "Freshness",
    status: "done",
    goal: "Cache, last-refreshed, and 'new since your last visit'.",
    items: [
      { label: "Browser remembers when it first saw each job (capped at 1,000)", done: true },
      { label: "'New' badges, '+N new' on the tab, 'New since last scan' tile, New-only filter", done: true },
      { label: "Nudge to rescan when results are over a day old", done: true },
      { label: "Posting cache cut from 6h to 1h; searches are always live", done: true },
    ],
  },
  {
    id: 6,
    title: "Submission",
    status: "in_progress",
    goal: "README with endpoint usage, demo video, deploy.",
    items: [
      { label: "Cost guard: rate limit, deep-search passcode, dev endpoint off in prod", done: true },
      { label: "README: how Search / Fetch / Agent are used + requirement mapping", done: true },
      { label: "Deployed: job-portal-career-finders.vercel.app (LLM via Gateway OIDC)", done: true },
      { label: "Demo video (shot list in docs/DEMO.md)", done: false },
    ],
  },
];
