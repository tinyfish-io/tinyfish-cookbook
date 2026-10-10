import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { Portal, TrackedSearch, Listing, AgentStatus } from "./types";
import { getVietnamDateString } from "./date";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 150; // ~7.5 min safety net — status field alone isn't trusted (see below)
const REAL_BROWSER_PROFILE = BrowserProfile.STEALTH;

let _client: TinyFish | null = null;
let _loggedKeyStatus = false;
function getClient(): TinyFish | null {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!_loggedKeyStatus) {
    _loggedKeyStatus = true;
    if (apiKey) {
      console.log(`[TinyFish] API key detected (${apiKey.slice(0, 4)}...${apiKey.slice(-4)}) — using real agents.`);
    } else {
      console.warn("[TinyFish] No TINYFISH_API_KEY found — sweep will return no real listings this run.");
    }
  }
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

function buildGoal(searches: TrackedSearch[]): string {
  const todayStr = getVietnamDateString();
  const searchLines = searches
    .map((s) => `   - search id ${s.id}: ${s.propertyType === "apartment" ? "apartment" : "house"} for ${s.intent} in "${s.area}"`)
    .join(" ");
  const plural = searches.length === 1 ? "search" : "searches";

  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7).`,
    "You are researching property listings only. Do not fill out any inquiry/contact form, do not create an account, do not log in.",
    "Work as quickly and efficiently as possible. Take the minimum number of steps needed.",
    `1. If a cookie banner or popup appears, dismiss it first.`,
    `2. Use this site's own search to look up each of these ${searches.length} ${plural}.`,
    searchLines,
    "3. For each search: try it once. If it succeeds and you can see listings, record up to 3 of the best-matching current listings and move to the next search immediately — do not re-search or double check. Only if that first attempt fails (page doesn't load, no results, error) do you retry, up to 2 total attempts for that search. As soon as one attempt succeeds, or you've used both attempts, stop and move on.",
    "4. For each listing found, record: a short title/description, the price in VND (for rent, the monthly rent; for sale, the total price), the floor area in square meters if shown, the number of bedrooms if shown, and the direct URL to the listing.",
    "5. If a search genuinely returns nothing on this site, omit it entirely — do not guess or invent listings.",
    "",
    "Return JSON matching this exact structure, with real values in place of the example:",
    '{"results": [{"searchId": "search-example", "listings": [{"title": "2BR apartment near Thao Dien", "price": 18000000, "areaSqm": 75, "bedrooms": 2, "url": "https://example.com/listing/123"}]}]}',
    "price must be a plain integer in VND — no currency symbol, no commas, no decimals.",
  ].join(" ");
}

interface RawListing {
  title: string;
  price: number;
  areaSqm?: number;
  bedrooms?: number;
  url: string;
}
interface RawResult {
  searchId: string;
  listings: RawListing[];
}
interface ScrapeResult {
  results: RawResult[];
}

function extractResult(result: Run["result"], portalName: string): ScrapeResult | null {
  if (!result) {
    console.log(`[listings] ${portalName}: run.result was empty/undefined`);
    return null;
  }
  if ((result as any).status === "failure" || (result as any).error) {
    console.log(`[listings] ${portalName}: agent reported goal failure — ${(result as any).error ?? "no message"}`);
    return null;
  }
  const rawResults = Array.isArray((result as any).results) ? (result as any).results : [];
  const valid: RawResult[] = rawResults
    .filter((r: any) => r && typeof r.searchId === "string" && Array.isArray(r.listings))
    .map((r: any) => ({
      searchId: r.searchId,
      listings: r.listings.filter((l: any) => l && typeof l.title === "string" && typeof l.price === "number" && l.price > 0 && typeof l.url === "string").slice(0, 3),
    }))
    .filter((r: RawResult) => r.listings.length > 0);

  if (rawResults.length > 0 && valid.length === 0) {
    console.log(`[listings] ${portalName}: got ${rawResults.length} result(s) but none matched the expected shape. Sample:`, JSON.stringify(rawResults[0]).slice(0, 300));
  }
  if (valid.length === 0) {
    console.log(`[listings] ${portalName}: nothing usable extracted. Raw result:`, JSON.stringify(result).slice(0, 500));
    return null;
  }
  return { results: valid };
}

async function pollUntilDone(client: TinyFish, runId: string, portalName: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    let run;
    try {
      run = await client.runs.get(runId);
    } catch (err) {
      console.error(`[listings] ${portalName}: poll #${attempt + 1} threw a connection error, retrying:`, err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    if (attempt < 5 || attempt % 6 === 0) {
      console.log(`[listings] ${portalName}: poll #${attempt + 1} → status=${run.status}`);
    }
    if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
      return run;
    }
    // Status field has been observed getting stuck reporting a
    // non-terminal value long after the real result was already ready —
    // don't trust it alone; if the payload has shown up, treat it as done.
    if (run.result && Object.keys(run.result as object).length > 0) {
      console.log(`[listings] ${portalName}: result payload present despite status=${run.status} — treating as complete`);
      return run;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error(`[listings] ${portalName}: gave up after ${MAX_POLL_ATTEMPTS} polls — status never reached a terminal value and no result payload appeared`);
  return null;
}

async function scrapePortal(portal: Portal, searches: TrackedSearch[]): Promise<ScrapeResult | null> {
  console.log(`[listings] ${portal.name}: worker started for ${searches.length} search(es)`);
  const client = getClient();
  if (!client) {
    console.log(`[listings] ${portal.name}: no client (no API key) — skipping`);
    return null;
  }
  try {
    console.log(`[listings] ${portal.name}: calling client.agent.queue...`);
    const queued = await client.agent.queue({ url: portal.url, goal: buildGoal(searches), browser_profile: REAL_BROWSER_PROFILE });
    console.log(`[listings] ${portal.name}: queue() returned, run_id=${queued.run_id ?? "none"}`);
    if (queued.error || !queued.run_id) {
      console.error(`TinyFish queue failed for ${portal.id}:`, queued.error?.message);
      return null;
    }
    const run = await pollUntilDone(client, queued.run_id, portal.name);
    if (!run) {
      console.error(`TinyFish run timed out for ${portal.id}`);
      return null;
    }
    const hasResultPayload = Boolean(run.result && Object.keys(run.result as object).length > 0);
    if (run.status !== RunStatus.COMPLETED && !hasResultPayload) {
      console.error(`TinyFish run ${run.status} for ${portal.id}: [${run.error?.category}] ${run.error?.message}`);
      return null;
    }
    return extractResult(run.result, portal.name);
  } catch (err) {
    console.error(`TinyFish error for ${portal.id}:`, err);
    return null;
  }
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

// Sweeps all 5 portals in parallel for the given (already-filtered-to-due)
// searches, calling onPortalDone the instant EACH portal finishes — not
// after all 5 — so results can be persisted and displayed progressively.
export async function runListingsSweep(
  portals: Portal[],
  dueSearches: TrackedSearch[],
  onPortalDone: (portal: Portal, result: ScrapeResult | null, status: AgentStatus) => void | Promise<void>
): Promise<void> {
  if (dueSearches.length === 0) {
    console.log("[listings] no searches are due — nothing to sweep");
    return;
  }
  const usingRealAgents = Boolean(process.env.TINYFISH_API_KEY);
  console.log(`[listings] sweep starting for ${portals.length} portals × ${dueSearches.length} due search(es)`);

  await runInBatches(portals, portals.length, async (portal) => {
    const result = await scrapePortal(portal, dueSearches);
    const status: AgentStatus = {
      portalId: portal.id,
      status: result ? "done" : usingRealAgents ? "error" : "done",
      lastSyncedAt: new Date().toISOString(),
      listingsFound: result?.results.reduce((sum, r) => sum + r.listings.length, 0) ?? 0,
    };
    try {
      await onPortalDone(portal, result, status);
    } catch (err) {
      console.error(`[listings] onPortalDone callback failed for ${portal.id} (sweep continues regardless):`, err);
    }
  });
}

export function toListings(searchId: string, portalId: string, raw: RawListing[]): Listing[] {
  return raw.map((l) => ({
    searchId,
    portalId,
    title: l.title,
    price: l.price,
    areaSqm: l.areaSqm ?? null,
    bedrooms: l.bedrooms ?? null,
    url: l.url,
    checkedAt: new Date().toISOString(),
    source: "real" as const,
  }));
}
