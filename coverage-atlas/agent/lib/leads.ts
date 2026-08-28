// The lead pool — what the scan learned about where to look next.
//
// Every search result we did not fetch and every outbound link on a page we did
// fetch is a lead. State Medicaid sites are shaped so that this matters: the
// preferred drug list landing page rarely names any drug, but it links to the
// dated PDF that does, and the provider-bulletin index links to the announcement
// that says what changed and when. Fetching only the top search result and
// giving up is how a scanner concludes "no published policy" about a state whose
// policy was one hop away.
//
// So leads are harvested continuously and spent by the backfill pass, cheapest
// and most promising first, deduplicated across the whole run so no URL is ever
// fetched twice on one scan.

export type Lead = {
  url: string
  title: string
  /** The state this lead might answer for, or null for national sources. */
  state: string | null
  source: "search" | "page_link"
  /** Higher is more promising. See `scoreLead`. */
  score: number
}

const JUNK = /(goodrx|singlecare|drugs\.com|healthline|webmd|reddit|facebook|twitter|linkedin|youtube|ro\.co|hims|noom|amazon|wikipedia)/i
const ASSET = /\.(png|jpe?g|gif|svg|css|js|ico|woff2?|mp4|zip)(\?|$)/i
const POLICY = /(pdl|preferred[-_ ]?drug|formulary|prior[-_ ]?auth|criteria|fee[-_ ]?schedule|bulletin|provider[-_ ]?notice|policy|coverage|update|memo|announcement)/i
const DATED = /(20(2[3-9]|3\d))/

/**
 * Rank a candidate URL by how likely it is to carry policy substance.
 *
 * Dated documents score highly on purpose: this scan wants a *history*, not just
 * a current answer, and a bulletin with a year in its path is the single most
 * reliable way to find what a state's rule was before it changed.
 */
export function scoreLead(url: string, title: string, stateName: string | null): number {
  if (ASSET.test(url)) return -1
  const haystack = `${url} ${title}`.toLowerCase()
  if (JUNK.test(haystack)) return -1

  let score = 0
  if (/\.gov(\/|$|:)/.test(url)) score += 40
  if (url.toLowerCase().includes("medicaid")) score += 18
  if (POLICY.test(haystack)) score += 22
  if (DATED.test(haystack)) score += 16 // dated documents are how history gets found
  if (url.toLowerCase().endsWith(".pdf")) score += 8
  if (stateName && title.toLowerCase().includes(stateName.toLowerCase())) score += 10
  return score
}

export class LeadPool {
  private byUrl = new Map<string, Lead>()
  private spent = new Set<string>()

  /** Record a candidate. Re-adding a known URL keeps the better score. */
  add(url: string, title: string, state: string | null, source: Lead["source"], stateName?: string | null): void {
    if (!url || !/^https?:\/\//i.test(url) || this.spent.has(url)) return
    const score = scoreLead(url, title, stateName ?? null)
    if (score <= 0) return
    const existing = this.byUrl.get(url)
    if (existing && existing.score >= score) return
    this.byUrl.set(url, { url, title, state, source, score })
  }

  /** Harvest the outbound links of a page we already paid to fetch. */
  addPageLinks(links: string[] | undefined, state: string | null, stateName: string | null, limit = 12): void {
    for (const url of (links ?? []).slice(0, 200)) {
      this.add(url, "", state, "page_link", stateName)
      if (this.byUrl.size > 400) break
    }
    void limit
  }

  /** Best unspent leads for a state (falling back to national ones), marked spent. */
  take(state: string | null, n: number): Lead[] {
    const picked = [...this.byUrl.values()]
      .filter((l) => !this.spent.has(l.url) && (state === null || l.state === state || l.state === null))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
    for (const lead of picked) {
      this.spent.add(lead.url)
      this.byUrl.delete(lead.url)
    }
    return picked
  }

  /** Mark URLs as spent without taking them — for anything fetched elsewhere. */
  markSpent(urls: string[]): void {
    for (const url of urls) {
      this.spent.add(url)
      this.byUrl.delete(url)
    }
  }

  get size(): number {
    return this.byUrl.size
  }

  countFor(state: string): number {
    return [...this.byUrl.values()].filter((l) => l.state === state || l.state === null).length
  }
}
