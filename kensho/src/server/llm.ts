import "server-only";

// Gemini via the REST generateContent endpoint with JSON-schema constrained output.
// Callers only see `structured()`, so swapping providers never touches the pipeline.
//
// Free-tier keys have small per-model daily quotas, so calls walk a model chain: when a
// model's daily quota is exhausted it is parked until Google's retry time and the next
// model takes over. Per-minute limits are waited out instead.

export const MODEL = process.env.KENSHO_MODEL || "gemini-3.8-flash";
const FALLBACKS = (process.env.KENSHO_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const CHAIN = [...new Set([MODEL, ...FALLBACKS])];
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const llmConfigured = () => !!process.env.GEMINI_API_KEY;

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not configured. Add it to .env to turn papers into manga.");
  return k;
}

export type Thinking = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
type SchemaMode = "json" | "openapi" | "prompt";

interface GeminiError {
  code?: number;
  message?: string;
  details?: { "@type"?: string; violations?: { quotaId?: string }[]; retryDelay?: string }[];
}
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: GeminiError;
}

class GeminiHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public dailyQuota: boolean,
    public retryMs: number,
  ) {
    super(message);
  }
}

// Models whose daily quota ran out, and when Google said to try again.
const g = globalThis as unknown as { __kenshoParked?: Map<string, number> };
const parked = (g.__kenshoParked ??= new Map<string, number>());

function parseError(status: number, err: GeminiError | undefined) {
  const quotaIds = (err?.details ?? []).flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? "");
  const delay = (err?.details ?? []).find((d) => d.retryDelay)?.retryDelay;
  const retryMs = delay ? Math.ceil(parseFloat(delay) * 1000) : 0;
  const dailyQuota = status === 429 && quotaIds.some((q) => /PerDay/i.test(q));
  // Readers see these messages, so rate limits are explained in plain words.
  const message =
    status === 429
      ? dailyQuota
        ? "Gemini’s daily free-tier quota for this model is used up."
        : "Gemini’s free-tier rate limit was reached — wait a minute and retry."
      : status >= 500
        ? "Gemini is overloaded right now — retry in a moment."
        : `Gemini ${status}: ${(err?.message ?? "request failed").split("\n")[0].slice(0, 240)}`;
  return new GeminiHttpError(message, status, dailyQuota, retryMs);
}

async function post(model: string, body: unknown): Promise<GeminiResponse> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(290_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (res.ok) return json;
    const err = parseError(res.status, json.error);
    // Daily quota: retrying burns nothing useful — hand over to the next model.
    if (err.dailyQuota) throw err;
    // Per-minute limits and overloads: wait as instructed (bounded), then retry.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.min(Math.max(err.retryMs, 3000 * 2 ** attempt), 65_000)));
      continue;
    }
    throw err;
  }
}

class MalformedJson extends Error {}

function extractJson(text: string) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const body = t.match(/\{[\s\S]*\}/)?.[0] ?? t;
  // Tolerate the most common slips (trailing commas) before giving up on a reply.
  for (const candidate of [t, body, body.replace(/,\s*([}\]])/g, "$1")]) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new MalformedJson("The model returned malformed JSON.");
}

async function generate<T>(model: string, opts: StructuredOpts): Promise<T> {
  const modes: SchemaMode[] = ["json", "openapi", "prompt"];
  let thinking: Thinking | null = opts.thinking ?? null;
  let lastErr: Error | null = null;

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      maxOutputTokens: Math.max(opts.maxTokens ?? 16000, 16000) * 2, // headroom for thinking tokens
      temperature: 0.7,
    };
    if (mode === "json") generationConfig.responseJsonSchema = opts.schema;
    if (mode === "openapi") generationConfig.responseSchema = opts.schema;
    if (thinking) generationConfig.thinkingConfig = { thinkingLevel: thinking };

    const user =
      mode === "prompt"
        ? `${opts.user}\n\nRespond with ONLY a JSON object (${opts.description}) matching this JSON Schema:\n${JSON.stringify(opts.schema)}`
        : `${opts.user}\n\nTask: ${opts.description}`;

    let res: GeminiResponse;
    try {
      res = await post(model, {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig,
      });
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof GeminiHttpError && e.status === 400) {
        // Some models don't accept a thinking level; drop it and retry the same mode.
        if (thinking && /think/i.test(e.message)) {
          thinking = null;
          i--;
          continue;
        }
        // Otherwise a 400 is usually the schema being rejected — try the next mode.
        if (mode !== "prompt") continue;
      }
      throw e;
    }

    if (res.promptFeedback?.blockReason) throw new Error(`Gemini blocked the request (${res.promptFeedback.blockReason}).`);
    const cand = res.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (cand?.finishReason === "MAX_TOKENS") throw new Error("The model ran out of room while writing; try again.");
    if (!text) throw new Error(`Gemini returned no content${cand?.finishReason ? ` (${cand.finishReason})` : ""}.`);
    try {
      return extractJson(text) as T;
    } catch (e) {
      // An unparseable reply is worth one more attempt in the next output mode.
      if (e instanceof MalformedJson && mode !== "prompt") {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("Structured generation failed.");
}

interface StructuredOpts {
  system: string;
  user: string;
  tool: string;
  description: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  thinking?: Thinking;
}

/** One structured call, walking the model chain past any model whose daily quota is spent. */
export async function structured<T>(opts: StructuredOpts & { onModel?: (model: string) => void }): Promise<T> {
  let quotaErr: GeminiHttpError | null = null;
  let lastErr: GeminiHttpError | null = null;
  for (const model of CHAIN) {
    const until = parked.get(model);
    if (until && until > Date.now()) continue;
    try {
      opts.onModel?.(model);
      return await generate<T>(model, opts);
    } catch (e) {
      if (e instanceof GeminiHttpError && e.dailyQuota) {
        parked.set(model, Date.now() + (e.retryMs || 60 * 60_000));
        quotaErr = e;
        continue;
      }
      // Still overloaded or rate-limited after retries: try the next model rather than failing the chapter.
      if (e instanceof GeminiHttpError && (e.status >= 500 || e.status === 429) && model !== CHAIN[CHAIN.length - 1]) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  if (lastErr && !quotaErr) throw lastErr;
  const soonest = Math.min(...CHAIN.map((m) => parked.get(m) ?? Infinity));
  const mins = Number.isFinite(soonest) ? Math.max(1, Math.round((soonest - Date.now()) / 60_000)) : null;
  throw new Error(
    `Every configured Gemini model has used its daily free-tier quota${mins ? ` (next one frees up in ~${mins} min)` : ""}. ` +
      `Retry later, or enable billing on the Gemini key. (${quotaErr?.message ?? "quota exhausted"})`,
  );
}
