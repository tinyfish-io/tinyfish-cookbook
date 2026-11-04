import { tinyfish } from "./tinyfish";
import { classifyUrl } from "./ats";
import { firecrawlEnabled, firecrawlSearch } from "./firecrawl";
import type { Candidate, Preferences } from "./types";

export const ATS_DOMAINS = [
  "job-boards.greenhouse.io",
  "boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "myworkdayjobs.com",
];

// Plain phrases, one query each: OR-chains combined with include_domains return nothing.
const SENIORITY_TERMS: Record<Preferences["seniority"], string[]> = {
  internship: ["intern", "co-op"],
  new_grad: ["new grad", "entry level"],
  any: [""],
};

const MAX_QUERIES = 6;

/** One query per (location, seniority term), so each gets its own top results. */
export function buildQueries(prefs: Preferences): string[] {
  const locations = prefs.locations.length ? prefs.locations.slice(0, 3) : [""];
  const queries = locations.flatMap((loc) =>
    SENIORITY_TERMS[prefs.seniority].map((term) =>
      [prefs.role, term, loc, ...prefs.keywords.slice(0, 2)].filter(Boolean).join(" "),
    ),
  );
  return queries.slice(0, MAX_QUERIES);
}

/**
 * TinyFish Search: find live postings on ATS job boards that match the preferences.
 * Any query that errors or comes back empty is retried on Firecrawl (if configured).
 */
export async function searchPostings(prefs: Preferences, pages = 1): Promise<Candidate[]> {
  const purpose = `Find currently open ${prefs.seniority.replace("_", " ")} job postings for a student job search`;
  const perQuery = await Promise.all(
    buildQueries(prefs).map(async (query) => {
      const tinyfishHits = await Promise.all(
        Array.from({ length: pages }, (_, page) =>
          tinyfish()
            .search.query({ query, page, include_domains: ATS_DOMAINS.join(","), purpose })
            .then((r) => r.results)
            .catch((err) => {
              console.warn("[search] TinyFish failed:", query, (err as Error).message);
              return [];
            }),
        ),
      );
      const hits = tinyfishHits.flat().map((r) => ({ url: r.url, title: r.title, snippet: r.snippet, provider: "tinyfish" as const }));
      if (hits.length || !firecrawlEnabled()) return hits;

      const fallback = await firecrawlSearch(query, ATS_DOMAINS).catch((err) => {
        console.warn("[search] Firecrawl fallback failed:", query, (err as Error).message);
        return [];
      });
      return fallback.map((r) => ({ ...r, provider: "firecrawl" as const }));
    }),
  );

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of perQuery.flat()) {
    const url = r.url.replace(/^http:/, "https:");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: r.title, snippet: r.snippet, ...classifyUrl(url), foundBy: "search", provider: r.provider });
  }
  return out;
}
