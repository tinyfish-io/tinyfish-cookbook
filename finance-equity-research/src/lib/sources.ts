// The scan plan: which sources a scan visits, how, and what each is for.
// Escalation ladder per cookbook: search → fetch → agent. One agent call per site.

export type Family = "sentiment" | "workforce" | "leadership" | "ops";

export type SourceProfile = {
  subreddits?: string[];        // ["CrackerBarrel"]
  trustpilotDomain?: string;    // "crackerbarrel.com"
  appStoreUrl?: string;
  googlePlayUrl?: string;
  careersUrl?: string;
  atsBoard?: { kind: "greenhouse" | "lever"; slug: string };
  edgarCik?: string;
  newsroomUrl?: string;
  downdetectorSlug?: string;
  companyDomain?: string;
};

export type SourceSpec = {
  key: string;
  label: string;
  family: Family;
  kind: "fetch" | "agent" | "code" | "search";
  stealth?: boolean;
  /** urls for fetch-kind, single url for agent-kind */
  urls: (p: SourceProfile) => string[];
  /** agent-kind (or fetch-fallback) goal with the JSON shape embedded */
  goal?: (companyName: string) => string;
  /** fetch-kind: when the plain fetch is blocked, escalate to a stealth agent with `goal` */
  agentFallback?: boolean;
  /** what the headline metric for this source should be — keeps the normalizer on-task */
  metricHint?: string;
  /** search-kind: query to run; top results get fetched and normalized */
  searchQuery?: (companyName: string) => string;
};

const evidenceShape = `Return STRICT JSON only:
{"items":[{"quote":"verbatim short excerpt","author_context":"reviewer/employee/etc","date":"YYYY-MM-DD or best guess","url":"link to the item if visible","tone":"negative|neutral|positive"}],
 "metric":{"value":<number or null>,"unit":"<unit>","note":"<one-line reading of the page>"}}`;

export const SOURCES: SourceSpec[] = [
  {
    key: "reddit",
    metricHint: "weekly count or share of negative posts about the company (never dollar amounts or anecdote numbers)",
    label: "Reddit",
    family: "sentiment",
    kind: "fetch",
    agentFallback: true,
    urls: (p) => (p.subreddits ?? []).slice(0, 2).map((s) => `https://www.reddit.com/r/${s}/new/`),
    goal: (name) =>
      `Read the newest ~40 posts on this subreddit. Extract posts about ${name}'s products, service, stores, or company direction. ${evidenceShape} Put the count of clearly negative posts in metric.value with unit "negative posts".`,
  },
  {
    key: "trustpilot",
    metricHint: "the TrustScore / average star rating shown on the page",
    label: "Trustpilot",
    family: "sentiment",
    kind: "fetch",
    agentFallback: true,
    urls: (p) => (p.trustpilotDomain ? [`https://www.trustpilot.com/review/${p.trustpilotDomain}`] : []),
    goal: (name) =>
      `Read the most recent reviews of ${name} on this page. ${evidenceShape} Put the average star rating shown in metric.value with unit "stars".`,
  },
  {
    key: "app_store",
    metricHint: "the current app star rating",
    label: "App Store",
    family: "sentiment",
    kind: "fetch",
    agentFallback: true,
    urls: (p) => (p.appStoreUrl ? [p.appStoreUrl] : []),
    goal: (name) =>
      `Read ${name}'s app listing: current rating, ratings count, and recent written reviews. ${evidenceShape} Put the current star rating in metric.value with unit "stars".`,
  },
  {
    key: "google_play",
    metricHint: "the current app star rating",
    label: "Google Play",
    family: "sentiment",
    kind: "fetch",
    agentFallback: true,
    urls: (p) => (p.googlePlayUrl ? [p.googlePlayUrl] : []),
    goal: (name) =>
      `Read ${name}'s Play Store listing: current rating and recent reviews. ${evidenceShape} Put the current star rating in metric.value with unit "stars".`,
  },
  {
    key: "careers",
    metricHint: "total open job postings",
    label: "Careers page",
    family: "workforce",
    kind: "agent",
    urls: (p) => {
      if (p.atsBoard?.kind === "greenhouse") return [`https://api.greenhouse.io/v1/boards/${p.atsBoard.slug}/jobs`];
      if (p.atsBoard?.kind === "lever") return [`https://api.lever.co/v0/postings/${p.atsBoard.slug}?mode=json`];
      return p.careersUrl ? [p.careersUrl] : [];
    },
    goal: (name) =>
      `Count the open job postings for ${name} on this page, broken down by department if shown. ${evidenceShape} Put total open roles in metric.value with unit "open".`,
  },
  {
    // targeted search + fetch beats browsing a tracker UI: faster, cheaper, same facts
    key: "layoffs",
    metricHint: "most recent layoff headcount (null if none)",
    label: "Layoff trackers",
    family: "workforce",
    kind: "search",
    urls: () => ["https://layoffs.fyi/"], // presence marker; actual urls come from search
    searchQuery: (name) => `"${name}" layoffs 2026 OR 2025 headcount site:layoffs.fyi OR site:warntracker.com OR site:techcrunch.com OR site:cnbc.com`,
  },
  {
    // deterministic: EDGAR is a structured public API — parsed in code, no LLM
    key: "edgar",
    label: "SEC EDGAR",
    family: "leadership",
    kind: "code",
    urls: (p) =>
      p.edgarCik
        ? [`https://data.sec.gov/submissions/CIK${p.edgarCik.padStart(10, "0")}.json`]
        : [],
  },
  {
    key: "newsroom",
    label: "Newsroom",
    family: "leadership",
    kind: "fetch",
    urls: (p) => (p.newsroomUrl ? [p.newsroomUrl] : []),
  },
  {
    key: "downdetector",
    metricHint: "current outage report count",
    label: "Downdetector",
    family: "ops",
    kind: "agent",
    stealth: true,
    urls: (p) => (p.downdetectorSlug ? [`https://downdetector.com/status/${p.downdetectorSlug}/`] : []),
    goal: (name) =>
      `Read the outage-report chart for ${name}. Is current report volume elevated vs the typical baseline shown? Any incident spikes in the visible window? ${evidenceShape} Put the current report count in metric.value with unit "reports" if visible.`,
  },
];

export const FAMILY_WEIGHTS: Record<Family, number> = {
  sentiment: 0.4,
  workforce: 0.3,
  leadership: 0.2,
  ops: 0.1,
};

export const FAMILY_LABELS: Record<Family, string> = {
  sentiment: "Customer Sentiment",
  workforce: "Workforce",
  leadership: "Leadership",
  ops: "Product / Ops",
};

/** Sources that apply given what the profile actually has. */
export function plannedSources(profile: SourceProfile): SourceSpec[] {
  return SOURCES.filter((s) => s.urls(profile).length > 0);
}
