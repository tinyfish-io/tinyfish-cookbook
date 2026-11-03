// Thin typed client over the three TinyFish primitives we use, in the order the
// escalation ladder uses them: search -> fetch -> agent. Search and fetch are
// free; agent is metered, so it only fires when the first two rungs fail.
//
// Deliberately built on the documented HTTP endpoints rather than the SDK: the
// scanner runs both inside a Next.js route and as a standalone CLI, and one
// dependency-free module that we control the retry policy of is easier to reason
// about than two call paths.

const SEARCH_URL = "https://api.search.tinyfish.ai"
const FETCH_URL = "https://api.fetch.tinyfish.ai"
const AGENT_URL = "https://agent.tinyfish.ai/v1/automation"

export type SearchResult = {
  position: number
  title: string
  url: string
  snippet?: string
  site_name?: string
  date?: string
}

export type FetchResult = {
  url: string
  final_url?: string
  title?: string
  description?: string
  language?: string
  text?: string
  links?: string[]
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december"

/**
 * Coerce whatever a model returned into an ISO date, or null.
 *
 * Schemas ask for `YYYY-MM-DD` and models mostly comply, but "January 21, 2026"
 * gets through often enough to matter — and a non-ISO date poisons every
 * comparison downstream, because the change feed sorts and windows on these
 * strings. Normalising once at the boundary is cheaper than defending every
 * comparison.
 */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const text = String(value).trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const written = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"))
  if (written) {
    const month = MONTHS.split("|").indexOf(written[1].toLowerCase()) + 1
    return `${written[3]}-${String(month).padStart(2, "0")}-${written[2].padStart(2, "0")}`
  }
  // Month and year only — assume the first of the month, which is how policy
  // effective dates are almost always written anyway.
  const monthYear = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{4})\\b`, "i"))
  if (monthYear) {
    const month = MONTHS.split("|").indexOf(monthYear[1].toLowerCase()) + 1
    return `${monthYear[2]}-${String(month).padStart(2, "0")}-01`
  }
  const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/)
  if (numeric) return `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`
  const yearOnly = text.match(/^(20[23]\d)$/)
  if (yearOnly) return `${yearOnly[1]}-01-01`
  return null
}

/** Anything that reads like a date the source is asserting about itself. */
export function guessDocumentDate(doc: Pick<FetchResult, "text" | "title" | "url">): string | null {
  const haystack = `${doc.title ?? ""} ${doc.url ?? ""} ${(doc.text ?? "").slice(0, 4000)}`
  const iso = haystack.match(/\b(20[23]\d)-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const months = "january|february|march|april|may|june|july|august|september|october|november|december"
  const written = haystack.match(new RegExp(`\\b(${months})\\s+(\\d{1,2}),?\\s+(20[23]\\d)\\b`, "i"))
  if (written) {
    const month = months.split("|").indexOf(written[1].toLowerCase()) + 1
    return `${written[3]}-${String(month).padStart(2, "0")}-${written[2].padStart(2, "0")}`
  }
  const numeric = haystack.match(/\b(\d{1,2})[./](\d{1,2})[./](20[23]\d)\b/)
  if (numeric) return `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`
  return null
}

export type AgentEvent = {
  type: "STARTED" | "STREAMING_URL" | "PROGRESS" | "COMPLETE" | string
  run_id?: string
  purpose?: string
  streaming_url?: string
  status?: string
  result?: unknown
  error?: unknown
}

export class TinyFishError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = "TinyFishError"
  }
}

function apiKey(): string {
  const key = process.env.TINYFISH_API_KEY
  if (!key) throw new TinyFishError("TINYFISH_API_KEY is not set", "MISSING_API_KEY")
  return key
}

async function withRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (err instanceof TinyFishError && err.code === "MISSING_API_KEY") throw err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * 2 ** i))
    }
  }
  throw new TinyFishError(`${label} failed after ${attempts} attempts: ${String(last)}`, "EXHAUSTED")
}

export type SearchOptions = {
  /** "web" | "news" — news narrows to dated coverage, which is what change discovery wants. */
  domainType?: "web" | "news"
  afterDate?: string
  page?: number
}

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
  return withRetry(`search(${query})`, 3, async () => {
    const params = new URLSearchParams({ query, location: "US", language: "en" })
    if (opts.domainType) params.set("domain_type", opts.domainType)
    if (opts.afterDate) params.set("after_date", opts.afterDate)
    if (opts.page) params.set("page", String(opts.page))

    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { "X-API-Key": apiKey() },
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) throw new TinyFishError(`search HTTP ${res.status}`, "HTTP_ERROR")
    const data = (await res.json()) as { results?: SearchResult[] }
    return data.results ?? []
  })
}

/**
 * Pull page contents as markdown. Accepts up to 10 URLs, fanned out server-side.
 * Per-URL failures land in `errors[]` rather than throwing, so a single 403 in a
 * batch never costs us the rest of the batch.
 */
export async function fetchContents(urls: string[], timeoutMs = 90_000): Promise<FetchResult[]> {
  if (urls.length === 0) return []
  return withRetry(`fetch(${urls.length} urls)`, 2, async () => {
    const res = await fetch(FETCH_URL, {
      method: "POST",
      headers: { "X-API-Key": apiKey(), "Content-Type": "application/json" },
      // Links are requested because outbound links are leads: a state's
      // preferred-drug-list landing page rarely names a drug, but it links to
      // the dated PDF that does.
      body: JSON.stringify({ urls: urls.slice(0, 10), format: "markdown", links: true }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new TinyFishError(`fetch HTTP ${res.status}`, "HTTP_ERROR")
    const data = (await res.json()) as { results?: FetchResult[]; errors?: { url: string; error: string }[] }
    return data.results ?? []
  })
}

export type AgentOptions = {
  url: string
  goal: string
  /** State Medicaid and cms.gov sites 403 plain fetchers, so this defaults to stealth. */
  stealth?: boolean
  onProgress?: (purpose: string) => void
  timeoutMs?: number
}

/**
 * Run a browser agent and stream its progress. The metered rung of the ladder.
 *
 * COMPLETED only means the browser finished without crashing — the caller must
 * validate the content of `result`, never just the status.
 */
export async function runAgent(opts: AgentOptions): Promise<unknown> {
  const body = {
    url: opts.url,
    goal: opts.goal,
    browser_profile: opts.stealth === false ? "lite" : "stealth",
    proxy_config: { enabled: true, country_code: "US" },
  }

  const res = await fetch(`${AGENT_URL}/run-sse`, {
    method: "POST",
    headers: { "X-API-Key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  })
  if (!res.ok || !res.body) throw new TinyFishError(`agent HTTP ${res.status}`, "HTTP_ERROR")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? "" // keep the partial line for the next chunk
    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      let event: AgentEvent
      try {
        event = JSON.parse(line.slice(5).trim())
      } catch {
        continue
      }
      if (event.type === "PROGRESS" && event.purpose) opts.onProgress?.(event.purpose)
      if (event.type === "COMPLETE") {
        reader.cancel().catch(() => {})
        if (!event.result) throw new TinyFishError(`agent returned no result (${event.status})`, "NO_RESULT")
        return event.result
      }
    }
  }
  throw new TinyFishError("agent stream ended without COMPLETE", "STREAM_ERROR")
}

/** Agent results arrive as a string, an object, or an object nested under `result`. */
export function unwrapAgentResult(raw: unknown): Record<string, unknown> | null {
  let value = raw
  if (typeof value === "string") {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/)
    const text = (fenced ? fenced[1] : value).trim()
    try {
      value = JSON.parse(text)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  const inner = obj.result
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as Record<string, unknown>
  return obj
}
