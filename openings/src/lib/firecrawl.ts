/**
 * Firecrawl: the fallback provider. TinyFish does the work; Firecrawl only steps in when a TinyFish
 * call fails or comes back empty, so one provider having a bad moment doesn't sink a run.
 *   - Search fallback: a TinyFish Search query that errors or returns nothing.
 *   - Render fallback: a page TinyFish Fetch only saw as a JS shell — tried here before Agent,
 *     because a Firecrawl scrape is ~2s and 1 credit vs 1–3 min for an Agent run.
 */
import type { PageRead } from "./read";

const API = "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = 45_000;
const CONCURRENCY = 3;

export function firecrawlEnabled(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`Firecrawl ${path} ${res.status}: ${json.error ?? "request failed"}`);
  return json as T;
}

/** Firecrawl appends the site name to titles ("… @ Zip - Jobs", "… - Greenhouse"). */
export function cleanFirecrawlTitle(title: string): string {
  return title
    .replace(/\s+[-|]\s+(Jobs|Greenhouse|Lever|Ashby|Myworkdayjobs\.com|[\w\s]+ Careers)$/i, "")
    .trim();
}

export interface FirecrawlHit {
  url: string;
  title: string;
  snippet: string;
}

export async function firecrawlSearch(query: string, domains: string[], limit = 10): Promise<FirecrawlHit[]> {
  const sites = domains.map((d) => `site:${d}`).join(" OR ");
  const res = await call<{ data?: { web?: { url: string; title?: string; description?: string }[] } }>("/search", {
    query: `${query} (${sites})`,
    limit,
  });
  return (res.data?.web ?? []).map((r) => ({
    url: r.url,
    title: cleanFirecrawlTitle(r.title ?? ""),
    snippet: r.description ?? "",
  }));
}

export async function firecrawlScrape(url: string): Promise<PageRead | null> {
  const res = await call<{ data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string; url?: string } } }>(
    "/scrape",
    { url, formats: ["markdown"], onlyMainContent: true },
  );
  const text = res.data?.markdown ?? "";
  if (!text.trim()) return null;
  const meta = res.data?.metadata ?? {};
  return { url, finalUrl: meta.url ?? meta.sourceURL ?? url, title: cleanFirecrawlTitle(meta.title ?? ""), text };
}

/** Scrape several URLs, 3 at a time. Failures are dropped (and counted by the caller). */
export async function firecrawlScrapeMany(urls: string[]): Promise<PageRead[]> {
  const out: PageRead[] = [];
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const page = await firecrawlScrape(url).catch((err) => {
          console.warn("[firecrawl] scrape failed:", url, (err as Error).message);
          return null;
        });
        if (page) out.push(page);
      }
    }),
  );
  return out;
}
