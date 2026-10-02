import {
  TinyFish,
  BrowserProfile,
  RunStatus,
  type CompleteEvent,
  type FetchResponse,
  type SearchQueryResponse,
} from "@tiny-fish/sdk";

// Cookbook conventions baked in (docs/research/tinyfish-api-reference.md):
// - never agent.run(); stream for interactive, queue+poll for bulk
// - COMPLETED only means the browser didn't crash — validate result content
// - one agent call per site; waves of 5 for plan concurrency limits

let client: TinyFish | undefined;
export function tf() {
  if (!process.env.TINYFISH_API_KEY) {
    throw new Error("tinyfish: TINYFISH_API_KEY is not set");
  }
  client ??= new TinyFish({ timeout: 780_000, maxRetries: 1 });
  return client;
}

export type AgentOutcome = {
  ok: boolean;
  runId?: string;
  result?: unknown;
  error?: string;
  durationMs: number;
};

export async function runAgent(opts: {
  url: string;
  goal: string;
  stealth?: boolean;
  proxyUS?: boolean;
  timeoutMs?: number;
  onProgress?: (purpose: string) => void;
  onStreamingUrl?: (streamingUrl: string, runId: string) => void;
}): Promise<AgentOutcome> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 300_000;
  let runId: string | undefined;
  let complete: CompleteEvent | undefined;

  try {
    const stream = await tf().agent.stream({
      url: opts.url,
      goal: opts.goal,
      browser_profile: opts.stealth ? BrowserProfile.STEALTH : BrowserProfile.LITE,
      ...(opts.proxyUS ? { proxy_config: { enabled: true, country_code: "US" as const } } : {}),
    });

    const timer = setTimeout(() => void stream.close(), timeoutMs);
    try {
      for await (const event of stream) {
        if (event.type === "STARTED") runId = event.run_id;
        else if (event.type === "STREAMING_URL") opts.onStreamingUrl?.(event.streaming_url, event.run_id);
        else if (event.type === "PROGRESS" && "purpose" in event && typeof event.purpose === "string")
          opts.onProgress?.(event.purpose);
        else if (event.type === "COMPLETE") {
          complete = event;
          break; // don't drain further
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const durationMs = Date.now() - started;
    if (!complete) {
      return { ok: false, runId, error: `timed out after ${Math.round(timeoutMs / 1000)}s`, durationMs };
    }
    // Stale-status server bug: a non-empty result counts as done regardless of status.
    const result = normalizeResult(complete.result);
    if (result != null) return { ok: true, runId: complete.run_id, result, durationMs };
    if (complete.status === RunStatus.COMPLETED) {
      return { ok: false, runId: complete.run_id, error: "run completed but returned no content", durationMs };
    }
    return {
      ok: false,
      runId: complete.run_id,
      error: complete.error?.message ?? `run ${complete.status.toLowerCase()} with no result`,
      durationMs,
    };
  } catch (err) {
    return { ok: false, runId, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - started };
  }
}

/** Results arrive as objects, JSON strings, or nested {result: …} — flatten defensively. */
function normalizeResult(raw: unknown): unknown {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof value === "object" && value !== null && "result" in (value as Record<string, unknown>)) {
    const inner = (value as Record<string, unknown>).result;
    if (inner != null && Object.keys(value as Record<string, unknown>).length <= 2) value = inner;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length === 0) return null;
  return value;
}

export async function searchWeb(query: string, opts?: { includeDomains?: string; recencyMinutes?: number }): Promise<SearchQueryResponse> {
  return tf().search.query({
    query,
    location: "US",
    language: "en",
    ...(opts?.includeDomains ? { include_domains: opts.includeDomains } : {}),
  });
}

export async function fetchPages(urls: string[], format: "markdown" | "json" = "markdown"): Promise<FetchResponse> {
  if (urls.length === 0 || urls.length > 10) throw new Error(`fetchPages: got ${urls.length} urls, need 1-10`);
  return tf().fetch.getContents({ urls, format, links: true });
}

/** Run tasks in waves of `size` — TinyFish plan concurrency is limited. */
export async function inWaves<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const wave = items.slice(i, i + size);
    const settled = await Promise.allSettled(wave.map((item, j) => fn(item, i + j)));
    for (const outcome of settled) {
      results.push(outcome.status === "fulfilled" ? outcome.value : (null as R));
    }
  }
  return results;
}
