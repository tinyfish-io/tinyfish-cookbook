import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { CompetitorListing, AgentStatus, CompetitorSite, Product } from "./types";
import { SITES, PRODUCTS } from "./seed";
import { getVietnamDateString } from "./date";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 90; // 7.5 min — real observed completions are 20-120s; TinyFish's own portal confirms completions this code was still calling "PENDING", so this is a safety net, not the primary signal anymore
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
      console.warn("[TinyFish] No TINYFISH_API_KEY found — sweep will return no real listings this run.");
    }
  }
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

function buildGoal(products: Product[]): string {
  const todayStr = getVietnamDateString();
  const productLines = products.map((p) => `   - "${p.searchTerm}" — product id ${p.id}`).join(" ");
  const plural = products.length === 1 ? "product" : "products";

  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7).`,
    "You are checking retail prices and stock only. Do not add anything to a cart, create an account, or log in.",
    "Work as quickly and efficiently as possible. Take the minimum number of steps needed. Do not re-read, re-check, or re-verify anything that already succeeded — once you have a price for a product, move on immediately.",
    "1. If a cookie banner or popup appears, dismiss it first.",
    `2. Use this site's own search to look up each of these ${products.length} ${plural}.`,
    productLines,
    "3. For each product: try the search once. If it succeeds and you can see a clear price, record it and move straight to the next product — do not search it again or double-check it. Only if that first attempt fails (page doesn't load, no results, error) do you retry, up to 3 total attempts for that product. As soon as one attempt succeeds, or you've used all 3 attempts, stop and move to the next product.",
    "4. For each product, if you find a clear match (same or very similar model), record its current price in VND and whether it's in stock (true), out of stock (false), or unclear (omit the stock field).",
    "5. If a product isn't found on this site at all, omit it entirely — do not guess or estimate a price.",
    "",
    "Return JSON matching this exact structure, with real values in place of the example:",
    '{"listings": [{"productId": "product-0", "price": 14990000, "inStock": true}]}',
    "price must be a plain integer in VND — no currency symbol, no commas, no decimals.",
  ].join(" ");
}

interface RawListing {
  productId: string;
  price: number;
  inStock?: boolean;
}
interface ScrapeResult {
  listings: RawListing[];
}

function extractResult(result: Run["result"], siteName: string): ScrapeResult | null {
  if (!result) {
    console.log(`[pricing] ${siteName}: run.result was empty/undefined`);
    return null;
  }
  if ((result as any).status === "failure" || (result as any).error) {
    console.log(`[pricing] ${siteName}: agent reported goal failure — ${(result as any).error ?? "no message"}`);
    return null;
  }
  const listings = Array.isArray((result as any).listings) ? (result as any).listings : [];
  const valid: RawListing[] = listings.filter(
    (l: any) => l && typeof l.productId === "string" && typeof l.price === "number" && l.price > 0
  );
  if (listings.length > 0 && valid.length === 0) {
    console.log(`[pricing] ${siteName}: got ${listings.length} listing(s) but none matched the expected shape. Sample:`, JSON.stringify(listings[0]).slice(0, 300));
  }
  if (valid.length === 0) {
    console.log(`[pricing] ${siteName}: nothing usable extracted. Raw result:`, JSON.stringify(result).slice(0, 500));
    return null;
  }
  return { listings: valid };
}

async function pollUntilDone(client: TinyFish, runId: string, siteName: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const run = await client.runs.get(runId);
      if (attempt < 5 || attempt % 6 === 0) {
        console.log(`[pricing] ${siteName}: poll #${attempt + 1} → status=${run.status}`);
      }
      if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
        return run;
      }
      // The status field has been observed getting stuck reporting a
      // non-terminal value (e.g. PENDING) for many minutes after TinyFish's
      // own dashboard already shows the run as Completed. Don't trust that
      // one field alone — if the actual result payload has shown up, the
      // run is functionally done regardless of what status says.
      if (run.result && Object.keys(run.result).length > 0) {
        console.log(`[pricing] ${siteName}: result payload present despite status=${run.status} — treating as complete`);
        return run;
      }
    } catch (err) {
      console.error(`[pricing] ${siteName}: poll #${attempt + 1} threw an error:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  console.error(`[pricing] ${siteName}: gave up after ${MAX_POLL_ATTEMPTS} polls (~${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 60000} min) — status field never reached a terminal value and no result payload appeared`);
  return null;
}

async function scrapeSite(site: CompetitorSite): Promise<ScrapeResult | null> {
  console.log(`[pricing] ${site.name}: worker started`);
  const client = getClient();
  if (!client) {
    console.log(`[pricing] ${site.name}: no client (no API key) — skipping`);
    return null;
  }

  try {
    console.log(`[pricing] ${site.name}: calling client.agent.queue...`);
    const queued = await client.agent.queue({ url: site.url, goal: buildGoal(PRODUCTS), browser_profile: REAL_BROWSER_PROFILE });
    console.log(`[pricing] ${site.name}: queue() returned, run_id=${queued.run_id ?? "none"}`);
    if (queued.error || !queued.run_id) {
      console.error(`TinyFish queue failed for ${site.id}:`, queued.error?.message);
      return null;
    }
    const run = await pollUntilDone(client, queued.run_id, site.name);
    console.log(`[pricing] ${site.name}: poll finished, status=${run?.status ?? "timed out"}`);
    if (!run) {
      console.error(`TinyFish run timed out for ${site.id}`);
      return null;
    }
    const hasResultPayload = Boolean(run.result && Object.keys(run.result).length > 0);
    if (run.status !== RunStatus.COMPLETED && !hasResultPayload) {
      console.error(`TinyFish run ${run.status} for ${site.id}: [${run.error?.category}] ${run.error?.message}`);
      return null;
    }
    return extractResult(run.result, site.name);
  } catch (err) {
    console.error(`TinyFish error for ${site.id}:`, err);
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

// Runs all 5 competitor sites in parallel, calling onSiteDone the moment
// EACH one finishes — not after the whole sweep — so results can be
// persisted and displayed progressively.
export async function runPricingSweep(
  onSiteDone?: (site: CompetitorSite, result: ScrapeResult | null, status: AgentStatus) => void | Promise<void>
): Promise<{ agentStatuses: Record<string, AgentStatus> }> {
  const usingRealAgents = Boolean(process.env.TINYFISH_API_KEY);
  console.log(`[pricing] sweep starting for ${SITES.length} sites, concurrency=${MAX_CONCURRENT_AGENTS}, realAgents=${usingRealAgents}`);
  const agentStatuses: Record<string, AgentStatus> = {};

  await runInBatches(SITES, MAX_CONCURRENT_AGENTS, async (site) => {
    const result = await scrapeSite(site);
    const status: AgentStatus = {
      siteId: site.id,
      status: result ? "done" : usingRealAgents ? "error" : "done",
      lastSyncedAt: new Date().toISOString(),
      listingsFound: result?.listings.length ?? 0,
    };
    agentStatuses[site.id] = status;

    if (onSiteDone) {
      try {
        await onSiteDone(site, result, status);
      } catch (err) {
        console.error(`[pricing] onSiteDone callback failed for ${site.id} (sweep continues regardless):`, err);
      }
    }
  });

  console.log(`[pricing] sweep finished — statuses: ${JSON.stringify(agentStatuses)}`);
  return { agentStatuses };
}

export function mergeListingsForSite(site: CompetitorSite, result: ScrapeResult, current: Record<string, CompetitorListing>): Record<string, CompetitorListing> {
  const next = { ...current };
  result.listings.forEach((l) => {
    const key = `${site.id}__${l.productId}`;
    next[key] = {
      siteId: site.id,
      productId: l.productId,
      price: l.price,
      inStock: l.inStock ?? null,
      lastChecked: new Date().toISOString(),
      source: "real",
    };
  });
  return next;
}
