import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { SitePriceSeries, AgentStatus, PricePoint, RouteCode, SiteInfo, RouteInfo } from "./types";
import { SITES } from "./seed";
import { getVietnamDateString } from "./date";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 360; // 30 minutes at 5s intervals — safety valve, not a real cap
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
      console.warn(
        "[TinyFish] No TINYFISH_API_KEY found in environment — falling back to simulated data for every sweep. " +
          "Check that .env.local exists in the project root (same folder as package.json), contains a line like " +
          "TINYFISH_API_KEY=your_key_here with no quotes, and that you fully restarted `npm run dev` after saving it."
      );
    }
  }
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

// TinyFish's documented best practice for repeated/scheduled scraping is to
// embed the exact JSON shape, with sample values, directly in the goal text.
// Routes are listed dynamically — whatever's currently in the routes store,
// not a fixed pair, so newly-added routes get searched automatically.
function buildGoal(routes: RouteInfo[]): string {
  const todayStr = getVietnamDateString();
  const routeLines = routes.map((r) => `   - ${r.fromCity} to ${r.toCity} — route code ${r.code}`).join(" ");
  const plural = routes.length === 1 ? "route" : "routes";

  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7). Use this as the reference point — do not use the site's default search date or your own assumption of today's date.`,
    "You are checking flight prices only. Do not book, purchase, or proceed past search results at any point.",
    "Do not enter any passenger name, contact info, or payment details. Do not click past the search results page.",
    "Work as quickly and efficiently as possible. Take the minimum number of steps needed. Do not re-read, re-check, or re-verify anything that already succeeded — once you have a price for a route, move on immediately.",
    "",
    "1. If a cookie banner, popup, or region/language selector appears, dismiss it first.",
    "2. Use the site's flight search for one-way, economy class, 1 adult passenger.",
    `3. Search each of these ${routes.length} ${plural} for exactly this departure date: ${todayStr}. Do not check any other date.`,
    routeLines,
    "4. For each route: try the search once. If it succeeds and you can see a price, extract it and move straight to the next route — do not search that route again or double-check it. Only if that first attempt fails (page doesn't load, no results, error) do you retry, up to 3 total attempts for that route. As soon as one attempt succeeds, or you've used all 3 attempts, stop and move to the next route.",
    "5. For each route, record only the lowest total price shown in the search results for that date.",
    "6. If a route isn't served by this site, omit it — do not estimate or guess a price.",
    "7. If the site shows a currency other than VND, convert to Vietnamese dong using the current rate.",
    "",
    "Return JSON matching this exact structure, with real values in place of the example:",
    `{"fares": [{"route": "${routes[0]?.code ?? "HAN-SGN"}", "price_vnd": 1250000}]}`,
    "price_vnd must be a plain integer — no currency symbol, no commas, no decimals.",
  ].join(" ");
}

type FareResult = { route: RouteCode; price_vnd: number };

function extractFares(result: Run["result"], validRoutes: Set<string>): FareResult[] | null {
  if (!result) return null;
  if ((result as any).status === "failure" || (result as any).error) return null;
  const fares = (result as any).fares;
  if (!Array.isArray(fares)) return null;
  return fares.filter(
    (f: any) => f && typeof f.route === "string" && validRoutes.has(f.route) && typeof f.price_vnd === "number" && f.price_vnd > 0
  );
}

async function pollUntilDone(client: TinyFish, runId: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const run = await client.runs.get(runId);
    if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

async function callTinyFish(site: SiteInfo, routes: RouteInfo[]): Promise<FareResult[] | null> {
  const client = getClient();
  if (!client) return null;
  const validRoutes = new Set(routes.map((r) => r.code));

  try {
    const queued = await client.agent.queue({ url: site.url, goal: buildGoal(routes), browser_profile: REAL_BROWSER_PROFILE });
    if (queued.error || !queued.run_id) {
      console.error(`TinyFish queue failed for ${site.id}:`, queued.error?.message);
      return null;
    }

    const run = await pollUntilDone(client, queued.run_id);
    if (!run) {
      console.error(`TinyFish run timed out for ${site.id}`);
      return null;
    }
    if (run.status !== RunStatus.COMPLETED) {
      console.error(`TinyFish run ${run.status} for ${site.id}: [${run.error?.category}] ${run.error?.message}`);
      return null;
    }

    const fares = extractFares(run.result, validRoutes);
    if (!fares || fares.length === 0) {
      console.error(`TinyFish run for ${site.id} returned no usable fares`);
      return null;
    }
    return fares;
  } catch (err) {
    console.error(`TinyFish error for ${site.id}:`, err);
    return null;
  }
}

// --- Skyscanner: Fetch (free, no automation) instead of Agent ---
function buildSkyscannerUrl(from: string, to: string): string {
  const iso = getVietnamDateString();
  const yymmdd = iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  return `https://www.skyscanner.com.vn/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${yymmdd}/`;
}

async function extractFaresFromTextsViaGroq(
  texts: { route: RouteCode; text: string }[],
  validRoutes: Set<string>
): Promise<FareResult[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || texts.length === 0) return [];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You extract flight prices from Skyscanner Vietnam search-results page content.",
              "You'll receive one excerpt per route, each labeled with its route code.",
              "For each excerpt, find the lowest one-way economy fare shown, in Vietnamese dong.",
              "If the excerpt shows no flights, an error page, a bot-check/captcha page, or you cannot find a clear price, omit that route entirely — never guess or estimate.",
              'Respond with ONLY a raw JSON object, no prose, no markdown fences: {"fares": [{"route": "HAN-SGN", "price_vnd": 1234000}]}.',
              "price_vnd must be a plain integer, no currency symbol, no separators.",
            ].join(" "),
          },
          {
            role: "user",
            content: texts.map((t) => `Route ${t.route}:\n${t.text.slice(0, 6000)}`).join("\n\n---\n\n"),
          },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      console.error(`Groq extraction failed: ${res.status} ${await res.text()}`);
      return [];
    }
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const fares = Array.isArray(parsed?.fares) ? parsed.fares : [];
    return fares.filter(
      (f: any) => f && typeof f.route === "string" && validRoutes.has(f.route) && typeof f.price_vnd === "number" && f.price_vnd > 0
    );
  } catch (err) {
    console.error("Groq extraction error:", err);
    return [];
  }
}

async function fetchSkyscannerFares(client: TinyFish, routes: RouteInfo[]): Promise<FareResult[] | null> {
  try {
    const urlEntries = routes.map((r) => ({ route: r.code, url: buildSkyscannerUrl(r.from, r.to) }));
    const urls = urlEntries.map((e) => e.url);
    const response = await client.fetch.getContents({ urls, format: "markdown" });

    if (response.errors.length > 0) {
      response.errors.forEach((e) => console.error(`Skyscanner fetch failed for ${e.url}: ${e.error}`));
    }

    const texts: { route: RouteCode; text: string }[] = [];
    response.results.forEach((result) => {
      const entry = urlEntries.find((e) => e.url === result.url);
      if (!entry || result.format !== "markdown" || !result.text) return;
      texts.push({ route: entry.route, text: result.text });
    });

    if (texts.length === 0) {
      console.error("Skyscanner fetch returned no usable page content");
      return null;
    }

    const validRoutes = new Set(routes.map((r) => r.code));
    const fares = await extractFaresFromTextsViaGroq(texts, validRoutes);
    if (fares.length === 0) {
      console.error("Skyscanner: no fares extracted from fetched pages");
      return null;
    }
    return fares;
  } catch (err) {
    console.error("Skyscanner fetch error:", err);
    return null;
  }
}

// Builds a "what's the market actually showing for this route right now"
// reference price, so sites that failed this sweep don't end up showing
// random, disconnected numbers next to sites that succeeded.
function buildRouteReferences(
  realResultsBySite: Record<string, FareResult[] | null>,
  priceSeries: Record<string, SitePriceSeries>,
  routes: RouteInfo[]
): Record<RouteCode, number | null> {
  const refs: Record<RouteCode, number | null> = {};

  routes.forEach((route) => {
    const thisSweepPrices: number[] = [];
    Object.values(realResultsBySite).forEach((fares) => {
      const match = fares?.find((f) => f.route === route.code);
      if (match) thisSweepPrices.push(match.price_vnd);
    });
    if (thisSweepPrices.length > 0) {
      refs[route.code] = thisSweepPrices.reduce((a, b) => a + b, 0) / thisSweepPrices.length;
      return;
    }

    type Best = { price: number; ts: number };
    let bestReal: Best | null = null;
    let bestAny: Best | null = null;
    for (const site of SITES) {
      const series = priceSeries[`${site.id}__${route.code}`];
      const last = series?.history[series.history.length - 1];
      if (!last) continue;
      const ts = new Date(last.timestamp).getTime();
      if (bestAny === null || ts > bestAny.ts) bestAny = { price: last.priceVnd, ts };
      if (last.source === "real" && (bestReal === null || ts > bestReal.ts)) bestReal = { price: last.priceVnd, ts };
    }
    refs[route.code] = bestReal?.price ?? bestAny?.price ?? null;
  });

  return refs;
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

export async function runAgentSweep(
  priceSeries: Record<string, SitePriceSeries>,
  routes: RouteInfo[]
): Promise<{
  priceSeries: Record<string, SitePriceSeries>;
  agentStatuses: Record<string, AgentStatus>;
}> {
  const realResultsBySite: Record<string, FareResult[] | null> = {};
  await runInBatches(SITES, MAX_CONCURRENT_AGENTS, async (site) => {
    const client = getClient();
    if (site.useFetch && client) {
      realResultsBySite[site.id] = await fetchSkyscannerFares(client, routes);
    } else {
      realResultsBySite[site.id] = await callTinyFish(site, routes);
    }
  });

  const routeReferences = buildRouteReferences(realResultsBySite, priceSeries, routes);
  const usingRealAgents = Boolean(process.env.TINYFISH_API_KEY);

  const nextSeries = { ...priceSeries };
  const agentStatuses: Record<string, AgentStatus> = {};

  SITES.forEach((site) => {
    const fares = realResultsBySite[site.id];

    if (fares && fares.length > 0) {
      fares.forEach((f) => {
        const key = `${site.id}__${f.route}`;
        const existing = nextSeries[key] ?? { siteId: site.id, routeCode: f.route, history: [] };
        const point: PricePoint = { timestamp: new Date().toISOString(), priceVnd: Math.round(f.price_vnd), source: "real" };
        nextSeries[key] = { ...existing, history: [...existing.history.slice(-27), point] };
      });
      agentStatuses[site.id] = {
        siteId: site.id,
        status: "done",
        lastSyncedAt: new Date().toISOString(),
        routesCovered: fares.map((f) => f.route),
      };
      return;
    }

    routes.forEach((route) => {
      const key = `${site.id}__${route.code}`;
      const reference = routeReferences[route.code];
      if (reference === null || reference === undefined) return;
      const existing = nextSeries[key] ?? { siteId: site.id, routeCode: route.code, history: [] };
      const spread = (Math.random() - 0.5) * 0.08;
      const price = Math.max(reference * (1 + spread), reference * 0.85);
      const point: PricePoint = {
        timestamp: new Date().toISOString(),
        priceVnd: Math.round(price / 1000) * 1000,
        source: "simulated",
      };
      nextSeries[key] = { ...existing, history: [...existing.history.slice(-27), point] };
    });

    agentStatuses[site.id] = {
      siteId: site.id,
      status: usingRealAgents ? "error" : "done",
      lastSyncedAt: new Date().toISOString(),
      routesCovered: routes.map((r) => r.code),
    };
  });

  return { priceSeries: nextSeries, agentStatuses };
}
