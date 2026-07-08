import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { Program, SiteInfo, AgentStatus, CompanyProfile } from "./types";
import { SITES } from "./seed";
import { getVietnamDateString } from "./date";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 360; // 30 minutes — safety valve, this runs in GitHub Actions, no real time pressure
const REAL_BROWSER_PROFILE = BrowserProfile.STEALTH;
const MAX_CONCURRENT_AGENTS = Number(process.env.TINYFISH_MAX_CONCURRENT ?? SITES.length);

let _client: TinyFish | null = null;
let _loggedKeyStatus = false;
function getClient(): TinyFish | null {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!_loggedKeyStatus) {
    _loggedKeyStatus = true;
    if (apiKey) {
      console.log(`[TinyFish] API key detected (${apiKey.slice(0, 4)}...${apiKey.slice(-4)}) — using real agents.`);
    } else {
      console.warn("[TinyFish] No TINYFISH_API_KEY found — discovery will return no real programs this run.");
    }
  }
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

type DiscoveredFare = { name: string; type: string; fundingSummary: string; deadline: string | null; applyUrl: string };
type DiscoveryResult = { programs: DiscoveredFare[]; portfolioCompanies: string[] };

function buildGoal(site: SiteInfo): string {
  const todayStr = getVietnamDateString();
  const isAggregator = site.id === "f6s";

  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7).`,
    "You are researching startup funding programs only. Do not fill out or submit any form. Do not create an account or log in.",
    "Work as quickly and efficiently as possible. Take the minimum number of steps needed. Do not click into every individual program's page if a listing page already shows what you need — only open a program's own page if the summary/list view is missing a required field.",
    isAggregator
      ? "This is a directory site listing many programs from many organizations. Filter or search for programs relevant to Vietnam or Southeast Asia specifically — ignore programs unrelated to this region."
      : "This is a single organization's own site. Find their currently open accelerator, grant, or investment program.",
    "1. If a cookie banner or popup appears, dismiss it first.",
    `2. Find currently open (or rolling/always-open) startup funding programs. Stop once you have found 10 — do not try to enumerate every program on the site. If there are more than 10, prioritize the ones with the soonest deadlines and skip the rest. For each one, record: the program name, its type (Accelerator, Grant, or VC Residency), a one-line funding summary (amount and terms, e.g. "$15,000 for 5% equity" or "non-dilutive grant"), the application deadline as an ISO date if one is stated (use null if rolling/no fixed deadline), and the direct URL to apply.`,
    "3. Separately, if this page or a linked \"portfolio\"/\"our companies\" page lists startups this organization has funded or worked with, record up to 10 of their names. Only use company names actually shown on the site — do not guess or invent any. Spend no more than one extra step looking for this — if it's not easy to find, skip it.",
    "4. Do not estimate or invent any field. If a piece of information isn't shown, omit that field or that whole program.",
    "",
    "Return JSON matching this exact structure:",
    '{"programs": [{"name": "VIISA Acceleration Program", "type": "Accelerator", "fundingSummary": "$15,000 for 5% equity", "deadline": "2026-08-01", "applyUrl": "https://example.com/apply"}], "portfolioCompanies": ["Example Co", "Another Startup"]}',
  ].join(" ");
}

function extractResult(result: Run["result"], siteName: string): DiscoveryResult | null {
  if (!result) {
    console.log(`[discovery] ${siteName}: run.result was empty/undefined`);
    return null;
  }
  if ((result as any).status === "failure" || (result as any).error) {
    console.log(`[discovery] ${siteName}: agent reported goal failure — ${(result as any).error ?? "no message"}`);
    return null;
  }
  const programs = Array.isArray((result as any).programs) ? (result as any).programs : [];
  const portfolioCompanies = Array.isArray((result as any).portfolioCompanies) ? (result as any).portfolioCompanies : [];
  const validPrograms = programs
    .filter((p: any) => p && typeof p.name === "string" && typeof p.type === "string" && typeof p.fundingSummary === "string")
    .slice(0, 10); // hard cap, regardless of what the agent returns — never let one runaway response flood the pipeline

  if (programs.length > 0 && validPrograms.length === 0) {
    console.log(
      `[discovery] ${siteName}: agent returned ${programs.length} program(s) but none matched the expected shape (name/type/fundingSummary as strings). Raw sample:`,
      JSON.stringify(programs[0]).slice(0, 300)
    );
  }
  if (validPrograms.length === 0 && portfolioCompanies.length === 0) {
    console.log(`[discovery] ${siteName}: nothing usable extracted. Raw result was:`, JSON.stringify(result).slice(0, 500));
    return null;
  }
  return { programs: validPrograms, portfolioCompanies: portfolioCompanies.filter((c: any) => typeof c === "string").slice(0, 10) };
}

async function pollUntilDone(client: TinyFish, runId: string, siteName: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const run = await client.runs.get(runId);
      if (attempt < 5 || attempt % 6 === 0) {
        // Log every attempt for the first ~25s, then every ~30s after that — enough
        // to see it's actually progressing without flooding the terminal on a long run.
        console.log(`[discovery] ${siteName}: poll #${attempt + 1} → status=${run.status}`);
      }
      if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
        return run;
      }
    } catch (err) {
      console.error(`[discovery] ${siteName}: poll #${attempt + 1} threw an error (TinyFish may not recognize this run_id):`, err);
      // Don't give up on one flaky poll — but if this keeps happening, it'll
      // eventually hit MAX_POLL_ATTEMPTS and return null like a normal timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

async function scrapeSite(site: SiteInfo): Promise<DiscoveryResult | null> {
  console.log(`[discovery] ${site.name}: worker started`);
  const client = getClient();
  if (!client) {
    console.log(`[discovery] ${site.name}: no client (no API key) — skipping`);
    return null;
  }

  try {
    console.log(`[discovery] ${site.name}: calling client.agent.queue...`);
    const queued = await client.agent.queue({ url: site.url, goal: buildGoal(site), browser_profile: REAL_BROWSER_PROFILE });
    console.log(`[discovery] ${site.name}: queue() returned, run_id=${queued.run_id ?? "none"}`);
    if (queued.error || !queued.run_id) {
      console.error(`TinyFish queue failed for ${site.id}:`, queued.error?.message);
      return null;
    }
    const run = await pollUntilDone(client, queued.run_id, site.name);
    console.log(`[discovery] ${site.name}: poll finished, status=${run?.status ?? "timed out"}`);
    if (!run) {
      console.error(`TinyFish run timed out for ${site.id}`);
      return null;
    }
    if (run.status !== RunStatus.COMPLETED) {
      console.error(`TinyFish run ${run.status} for ${site.id}: [${run.error?.category}] ${run.error?.message}`);
      return null;
    }
    const result = extractResult(run.result, site.name);
    if (!result) {
      console.error(`TinyFish run for ${site.id} returned no usable programs`);
      return null;
    }
    return result;
  } catch (err) {
    console.error(`TinyFish error for ${site.id}:`, err);
    return null;
  }
}

// Simple keyword-overlap heuristic — no LLM call needed just to rank
// programs by fit. Real Groq usage is saved for actually drafting answers,
// where it matters far more.
function computeMatchScore(program: DiscoveredFare, profile: CompanyProfile): number {
  if (!profile.sector) return 50;
  const haystack = `${program.name} ${program.fundingSummary} ${program.type}`.toLowerCase();
  const keywords = profile.sector.toLowerCase().split(/[\s,/]+/).filter(Boolean);
  const hits = keywords.filter((k) => haystack.includes(k)).length;
  const base = 55;
  return Math.min(97, base + hits * 12 + Math.round(Math.random() * 8));
}

async function runInBatches<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Merges one site's freshly-scraped programs into a program list, using the
// same normalized-name dedup rule as a full sweep. Exposed separately so a
// caller can persist after every single site, not just at the end.
export function mergeSiteResult(
  site: SiteInfo,
  result: DiscoveryResult,
  currentPrograms: Program[],
  companyProfile: CompanyProfile
): Program[] {
  const existingByName = new Map(currentPrograms.filter((p) => p.source === "real").map((p) => [normalizeName(p.name), p]));
  const next = [...currentPrograms];

  result.programs.forEach((p, i) => {
    const nameKey = normalizeName(p.name);
    const existing = existingByName.get(nameKey);
    const program: Program = {
      id: existing?.id ?? `${site.id}-${i}-${Date.now()}`,
      name: p.name,
      type: (["Accelerator", "Grant", "VC Residency"].includes(p.type) ? p.type : "Accelerator") as Program["type"],
      location: site.name,
      url: site.url,
      applyUrl: p.applyUrl || site.url,
      fundingSummary: p.fundingSummary,
      deadline: p.deadline,
      matchScore: computeMatchScore(p, companyProfile),
      foundAt: existing?.foundAt ?? new Date().toISOString(),
      source: "real",
    };
    const existingIndex = next.findIndex((existingProgram) => normalizeName(existingProgram.name) === nameKey);
    if (existingIndex >= 0) next[existingIndex] = program;
    else next.push(program);
  });

  return next;
}

// Runs all 6 sources in parallel. Calls onSiteDone the moment EACH site
// finishes — not after the whole sweep completes — so a caller can persist
// and display results progressively (e.g. the first agent to finish shows
// up on the dashboard immediately, instead of everyone waiting for the
// slowest of the 6 to finish before anything appears).
export async function runDiscoverySweep(
  existingPrograms: Program[],
  companyProfile: CompanyProfile,
  onSiteDone?: (site: SiteInfo, result: DiscoveryResult | null, status: AgentStatus) => void | Promise<void>
): Promise<{ programs: Program[]; agentStatuses: Record<string, AgentStatus>; portfolioBySite: Record<string, string[]> }> {
  const usingRealAgents = Boolean(process.env.TINYFISH_API_KEY);
  console.log(`[discovery] sweep starting for ${SITES.length} sites, concurrency=${MAX_CONCURRENT_AGENTS}, realAgents=${usingRealAgents}`);
  let runningPrograms = [...existingPrograms];
  const agentStatuses: Record<string, AgentStatus> = {};
  const portfolioBySite: Record<string, string[]> = {};

  await runInBatches(SITES, MAX_CONCURRENT_AGENTS, async (site) => {
    const result = await scrapeSite(site);
    const status: AgentStatus = {
      siteId: site.id,
      status: result ? "done" : usingRealAgents ? "error" : "done",
      lastSyncedAt: new Date().toISOString(),
      programsFound: result?.programs.length ?? 0,
    };
    agentStatuses[site.id] = status;

    if (result) {
      portfolioBySite[site.id] = result.portfolioCompanies;
      runningPrograms = mergeSiteResult(site, result, runningPrograms, companyProfile);
    }

    // Isolated on purpose: if the caller's onSiteDone (e.g. a store write)
    // throws, it must never take down the whole sweep or block other sites
    // still in flight — that would look exactly like "agents never fired"
    // from the outside, when really one bad write silently killed everything.
    if (onSiteDone) {
      try {
        await onSiteDone(site, result, status);
      } catch (err) {
        console.error(`[discovery] onSiteDone callback failed for ${site.id} (sweep continues regardless):`, err);
      }
    }
  });

  console.log(`[discovery] sweep finished — statuses: ${JSON.stringify(agentStatuses)}`);
  return { programs: runningPrograms, agentStatuses, portfolioBySite };
}
