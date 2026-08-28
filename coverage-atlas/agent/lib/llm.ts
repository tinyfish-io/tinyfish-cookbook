// OpenRouter client with two-tier model routing and a token ledger.
//
// The routing is the point. Planning, source ranking and change narration are
// judgement calls that a small model gets wrong in ways that are expensive to
// notice, so they go to the smart model — but there are only ever three or four
// of those calls per scan. Per-state criteria extraction is a mechanical
// transcription job against a pre-windowed excerpt, and that is where the volume
// is, so it goes to the cheap model. Every call is accounted for in `ledger`.

export type Tier = "smart" | "cheap"

const MODELS: Record<Tier, string> = {
  smart: process.env.OPENROUTER_MODEL_SMART ?? "anthropic/claude-sonnet-4.5",
  cheap: process.env.OPENROUTER_MODEL_CHEAP ?? "google/gemini-2.5-flash",
}

export const ledger = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  byTier: { smart: 0, cheap: 0 } as Record<Tier, number>,
  reset() {
    this.calls = 0
    this.promptTokens = 0
    this.completionTokens = 0
    this.byTier = { smart: 0, cheap: 0 }
  },
}

export class LLMError extends Error {}

export type JsonCallOptions = {
  tier: Tier
  system: string
  user: string
  /** JSON Schema the response must satisfy. Enforced by OpenRouter structured outputs. */
  schema: Record<string, unknown>
  schemaName: string
  maxTokens?: number
  label?: string
}

/**
 * One structured-JSON completion. Retries on transport failure and on a payload
 * that does not parse; a model that returns prose twice is a model we stop
 * paying for rather than one we keep coaxing.
 */
export async function askJson<T>(opts: JsonCallOptions): Promise<T> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new LLMError("OPENROUTER_API_KEY is not set")

  const model = MODELS[opts.tier]
  let lastError = ""

  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/MMeteorL/Coverage-Atlas",
          "X-Title": "Coverage Atlas",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: opts.maxTokens ?? 4000,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
          },
        }),
        signal: AbortSignal.timeout(180_000),
      })
    } catch (err) {
      lastError = `transport: ${String(err)}`
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
      continue
    }

    if (!res.ok) {
      lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`
      // 4xx other than rate-limiting will not fix itself on retry.
      if (res.status !== 429 && res.status < 500) break
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
      continue
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      error?: { message?: string }
    }
    if (data.error) {
      lastError = data.error.message ?? "openrouter error"
      continue
    }

    ledger.calls++
    ledger.byTier[opts.tier]++
    ledger.promptTokens += data.usage?.prompt_tokens ?? 0
    ledger.completionTokens += data.usage?.completion_tokens ?? 0

    const content = data.choices?.[0]?.message?.content
    if (!content) {
      lastError = "empty completion"
      continue
    }
    try {
      // Some providers still wrap strict JSON in a fence.
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      return JSON.parse((fenced ? fenced[1] : content).trim()) as T
    } catch {
      lastError = `unparseable JSON: ${content.slice(0, 200)}`
    }
  }

  throw new LLMError(`${opts.label ?? opts.schemaName} failed on ${model} — ${lastError}`)
}

export function modelFor(tier: Tier): string {
  return MODELS[tier]
}
