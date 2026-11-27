import "server-only";

// Thin REST client for the three TinyFish endpoints Kenshō relies on.
// Endpoints and fields follow docs.tinyfish.ai (Search API, Fetch API, Agent API /run-sse).

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const AGENT_SSE_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

export class TinyFishError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function key() {
  const k = process.env.TINYFISH_API_KEY;
  if (!k) throw new TinyFishError("TINYFISH_API_KEY is not configured on the server.");
  return k;
}

async function readError(res: Response) {
  const body = await res.text().catch(() => "");
  return new TinyFishError(`TinyFish ${res.status}: ${body.slice(0, 300) || res.statusText}`, res.status);
}

/* ───────────── Search ───────────── */

export interface SearchResult {
  position: number;
  title: string;
  url: string;
  snippet?: string;
  site_name?: string;
  // research_paper domain extras
  authors?: string[];
  year?: number;
  venue?: string;
  cited_by_count?: number;
  pdf_url?: string;
}

export interface SearchParams {
  query: string;
  domain_type?: "web" | "news" | "research_paper";
  include_domains?: string;
  exclude_domains?: string;
  page?: number;
  pub_year_min?: number;
  pub_year_max?: number;
  purpose?: string;
  language?: string;
}

export async function search(params: SearchParams, signal?: AbortSignal): Promise<SearchResult[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await fetch(`${SEARCH_URL}?${qs}`, {
    headers: { "X-API-Key": key() },
    signal: signal ?? AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as { results?: SearchResult[] };
  return json.results ?? [];
}

/* ───────────── Fetch ───────────── */

export interface FetchedPage {
  url: string;
  final_url?: string;
  title?: string;
  description?: string;
  text: string;
  links?: string[];
}

export interface FetchResponse {
  results: FetchedPage[];
  errors: { url: string; error: string }[];
}

export async function fetchContent(
  urls: string[],
  opts: { links?: boolean; purpose?: string; perUrlTimeoutMs?: number } = {},
): Promise<FetchResponse> {
  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: { "X-API-Key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      urls,
      format: "markdown",
      links: opts.links ?? false,
      purpose: opts.purpose,
      per_url_timeout_ms: opts.perUrlTimeoutMs ?? 60_000,
    }),
    signal: AbortSignal.timeout((opts.perUrlTimeoutMs ?? 60_000) + 15_000),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as Partial<FetchResponse>;
  return {
    results: (json.results ?? []).map((r) => ({ ...r, text: typeof r.text === "string" ? r.text : "" })),
    errors: (json.errors ?? []).map((e) => ({ url: e.url, error: typeof e.error === "string" ? e.error : JSON.stringify(e.error) })),
  };
}

/* ───────────── Agent (browser automation) ───────────── */

export interface AgentEvent {
  type: string;
  run_id?: string;
  purpose?: string;
  status?: string;
  result?: unknown;
  error?: unknown;
}

/**
 * Runs a goal in a real TinyFish browser and streams progress. Metered, so callers use it
 * only when Fetch alone could not reach the content.
 */
export async function runAgent(
  url: string,
  goal: string,
  onProgress?: (text: string) => void,
  timeoutMs = 180_000,
): Promise<{ status: string; result: unknown; runId?: string }> {
  const res = await fetch(AGENT_SSE_URL, {
    method: "POST",
    headers: { "X-API-Key": key(), "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ url, goal }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok || !res.body) throw await readError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let runId: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      let ev: AgentEvent;
      try {
        ev = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      runId = ev.run_id ?? runId;
      if (ev.type === "PROGRESS" && ev.purpose) onProgress?.(ev.purpose);
      if (ev.type === "COMPLETE") {
        reader.cancel().catch(() => {});
        return { status: ev.status ?? "COMPLETED", result: ev.result ?? null, runId };
      }
      if (ev.type === "ERROR") {
        throw new TinyFishError(`Agent run failed: ${JSON.stringify(ev.error ?? ev).slice(0, 300)}`);
      }
    }
  }
  throw new TinyFishError("Agent stream ended without a result.");
}
