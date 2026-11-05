import { ConflictError, TinyFish } from "@tiny-fish/sdk";

import type { RunRecord } from "./types.ts";
import { parseRunRecord } from "./types.ts";

const BASE_URL = "https://agent.tinyfish.ai";
const SETUP_TIMEOUT_SECONDS = 900;
// The runner enforces its own deadline. This only stops the sdk cutting a long stream first.
const SDK_TIMEOUT_MS = 40 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 6000;

export class TinyFishError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "TinyFishError";
    this.status = status;
    this.code = code;
  }
}

export interface RunRequest {
  url: string;
  goal: string;
  maxDurationSeconds: number;
  profileId?: string | undefined;
  outputSchema?: Record<string, unknown> | undefined;
  /** Null browses from wherever TinyFish chooses. */
  proxyCountry: string | null;
}

export interface SearchResult {
  url: string;
  title: string;
}

export type RunEvent =
  | { type: "started"; runId: string }
  | { type: "live"; runId: string; streamingUrl: string }
  | { type: "progress"; runId: string; text: string; at: string }
  | { type: "complete"; runId: string; status: RunRecord["status"] };

export interface SetupSession {
  sessionId: string;
  cdpUrl: string;
  expiresAt: string;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class TinyFishClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #sdk: TinyFish;

  constructor({ apiKey, baseUrl = BASE_URL }: ClientOptions) {
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
    // No retries: a retried start is a second billed run in a second browser.
    this.#sdk = new TinyFish({ apiKey, baseURL: baseUrl, maxRetries: 0, timeout: SDK_TIMEOUT_MS });
  }

  async *streamRun(request: RunRequest, signal?: AbortSignal): AsyncGenerator<RunEvent> {
    const stream = await this.#sdk.agent.stream(
      {
        url: request.url,
        goal: request.goal,
        browser_profile: "stealth",
        proxy_config: {
          enabled: true,
          ...(request.proxyCountry ? { country_code: request.proxyCountry } : {}),
        },
        agent_config: { max_duration_seconds: request.maxDurationSeconds },
        // The page text is what lets a quote be checked rather than taken on trust.
        capture_config: { html: true },
        ...(request.outputSchema ? { output_schema: request.outputSchema } : {}),
        ...(request.profileId ? { use_profile: true, profile_id: request.profileId } : {}),
      },
      signal ? { signal } : {},
    );

    for await (const event of stream) {
      switch (event.type) {
        case "STARTED":
          yield { type: "started", runId: event.run_id };
          break;
        case "STREAMING_URL":
          yield { type: "live", runId: event.run_id, streamingUrl: event.streaming_url };
          break;
        case "PROGRESS":
          yield { type: "progress", runId: event.run_id, text: event.purpose, at: event.timestamp };
          break;
        case "COMPLETE":
          yield { type: "complete", runId: event.run_id, status: event.status };
          break;
        default:
          break;
      }
    }
  }

  /** Reads the record directly, because the sdk's `runs.get` drops the `steps` array. */
  async getRun(runId: string): Promise<RunRecord> {
    const response = await this.#request("GET", `/v1/runs/${encodeURIComponent(runId)}`);
    return parseRunRecord(await response.json());
  }

  async cancelRun(runId: string): Promise<void> {
    await this.#request("POST", `/v1/runs/${encodeURIComponent(runId)}/cancel`);
  }

  async getScreenshot(runId: string, stepId: string): Promise<Uint8Array> {
    const path = `/v1/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/screenshot`;
    const response = await this.#request("GET", path);
    return new Uint8Array(await response.arrayBuffer());
  }

  async getStepHtml(runId: string, stepId: string): Promise<string> {
    const path = `/v1/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/html`;
    const response = await this.#request("GET", path);
    return response.text();
  }

  /** The site search behind the planner, which goes without results rather than wait for long. */
  async search(query: string, location: string | null): Promise<SearchResult[]> {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Search timed out")), SEARCH_TIMEOUT_MS);
    });
    try {
      const { results } = await Promise.race([
        this.#sdk.search.query({ query, ...(location ? { location } : {}) }),
        timedOut,
      ]);
      return results.map(({ url, title }) => ({ url, title }));
    } finally {
      clearTimeout(timer);
    }
  }

  async createProfile(name: string, proxyCountry: string | null): Promise<string> {
    const response = await this.#request("POST", "/v1/profiles", {
      name,
      ...(proxyCountry ? { proxy_country_code: proxyCountry } : {}),
    });
    const { id } = (await response.json()) as { id: string };
    return id;
  }

  async deleteProfile(profileId: string): Promise<void> {
    try {
      await this.#request("DELETE", `/v1/profiles/${encodeURIComponent(profileId)}`);
    } catch (error) {
      if (error instanceof TinyFishError && error.status === 404) return;
      throw error;
    }
  }

  async startSetup(profileId: string, url: string): Promise<SetupSession> {
    const session = await this.#sdk.profiles.setup.start(profileId, {
      url,
      timeout_seconds: SETUP_TIMEOUT_SECONDS,
    });
    return {
      sessionId: session.session_id,
      cdpUrl: session.cdp_url,
      expiresAt: session.expires_at,
    };
  }

  async saveSetup(profileId: string, sessionId: string, site: string): Promise<void> {
    try {
      await this.#sdk.profiles.setup.save(profileId, {
        session_id: sessionId,
        signed_in_sites: [site],
      });
    } catch (error) {
      // TinyFish keeps the browser open on a 409, so the person can finish and press Done again.
      if (error instanceof ConflictError) throw new TinyFishError(error.message, 409);
      throw error;
    }
  }

  async cancelSetup(profileId: string, sessionId: string): Promise<void> {
    await this.#sdk.profiles.setup.cancel(profileId, { session_id: sessionId });
  }

  async #request(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.#apiKey,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.ok) return response;

    const detail = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new TinyFishError(
      detail?.error?.message ?? `TinyFish answered ${response.status}`,
      response.status,
      detail?.error?.code ?? null,
    );
  }
}
