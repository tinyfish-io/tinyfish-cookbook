import "server-only";
import { createHash } from "node:crypto";
import type { Availability, Paper, SearchResponse } from "@/lib/types";
import { search, type SearchResult } from "./tinyfish";
import { getPapers, getSearch, saveSearch, upsertPaper } from "./db";

// Topic → real papers. TinyFish is the discovery engine: its research-paper index gives
// scholarly metadata, and a second web search scoped to open repositories catches preprints
// the index ranks lower. The arXiv API only enriches arXiv hits with their full abstracts.

const OPEN_REPOSITORIES = [
  "arxiv.org",
  "openreview.net",
  "biorxiv.org",
  "medrxiv.org",
  "aclanthology.org",
  "proceedings.neurips.cc",
  "proceedings.mlr.press",
  "ncbi.nlm.nih.gov",
  "journals.plos.org",
  "eprint.iacr.org",
];

// Hosts that normally gate full text behind a subscription unless an open PDF is listed.
const GATED_HOSTS = ["sciencedirect.com", "ieeexplore.ieee.org", "dl.acm.org", "link.springer.com", "onlinelibrary.wiley.com", "tandfonline.com", "jstor.org"];

const CACHE_MS = 6 * 60 * 60 * 1000;

export function arxivIdFrom(...candidates: (string | undefined | null)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(/arxiv\.org\/(?:abs|pdf|html)\/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+(?:\.[A-Z]{2})?\/[0-9]{7})/i) ?? c.match(/arXiv:([0-9]{4}\.[0-9]{4,5})/i);
    if (m) return m[1].replace(/v\d+$/, "");
  }
  return null;
}

function doiFrom(...candidates: (string | undefined | null)[]): string | null {
  for (const c of candidates) {
    const m = c?.match(/\b(10\.\d{4,9}\/[^\s?#"<>]+)/);
    if (m) return m[1].replace(/[.)]+$/, "");
  }
  return null;
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const normTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 90);

function paperKey(p: Pick<Paper, "arxivId" | "doi" | "title">) {
  if (p.arxivId) return `arxiv:${p.arxivId}`;
  if (p.doi) return `doi:${p.doi.toLowerCase()}`;
  return `title:${normTitle(p.title)}`;
}

export const paperIdFor = (p: Pick<Paper, "arxivId" | "doi" | "title">) =>
  createHash("sha1").update(paperKey(p)).digest("hex").slice(0, 12);

function guessAvailability(url: string, pdfUrl: string | null): Availability {
  const h = host(url);
  if (pdfUrl) return "full_text";
  if (OPEN_REPOSITORIES.some((d) => h.endsWith(d))) return "full_text";
  if (GATED_HOSTS.some((d) => h.endsWith(d))) return "abstract_only";
  return "unknown";
}

function cleanTitle(t: string) {
  return t.replace(/\s+/g, " ").replace(/^\[(pdf|html|book|citation)\]\s*/i, "").trim();
}

function fromResearchResult(r: SearchResult, via: string): Paper | null {
  if (!r.title || !r.url) return null;
  const title = cleanTitle(r.title);
  const pdfUrl = r.pdf_url ?? (/\.pdf($|\?)/i.test(r.url) ? r.url : null);
  const arxivId = arxivIdFrom(r.url, r.pdf_url, r.venue);
  const base = { arxivId, doi: doiFrom(r.url), title };
  return {
    id: paperIdFor(base),
    ...base,
    authors: (r.authors ?? []).map((a) => a.replace(/…$/, "").trim()).filter(Boolean),
    year: r.year ?? null,
    venue: r.venue && !/^arXiv preprint/i.test(r.venue) ? r.venue.replace(/\s*…\s*/g, " ").trim() : arxivId ? "arXiv" : r.venue ?? null,
    abstract: r.snippet?.replace(/\s+/g, " ").trim() || null,
    abstractIsSnippet: true,
    url: r.url,
    pdfUrl: pdfUrl ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null),
    siteName: r.site_name ?? host(r.url),
    citedBy: r.cited_by_count ?? null,
    availability: guessAvailability(r.url, pdfUrl ?? (arxivId ? "arxiv" : null)),
    discoveredVia: [via],
    discoveredAt: new Date().toISOString(),
  };
}

/** Web results are only kept when the URL is clearly an individual paper page. */
function fromRepositoryResult(r: SearchResult, via: string): Paper | null {
  if (!r.title || !r.url) return null;
  const isPaperPage =
    /arxiv\.org\/(abs|pdf|html)\//.test(r.url) ||
    /openreview\.net\/(forum|pdf)\?id=/.test(r.url) ||
    /(bio|med)rxiv\.org\/content\/10\./.test(r.url) ||
    /aclanthology\.org\/[\w.\-]+\/?$/.test(r.url) ||
    /proceedings\.(neurips\.cc|mlr\.press)\//.test(r.url) ||
    /ncbi\.nlm\.nih\.gov\/pmc\/articles\/PMC\d+/.test(r.url) ||
    /journals\.plos\.org\/.+article\?id=/.test(r.url) ||
    /eprint\.iacr\.org\/\d{4}\/\d+/.test(r.url);
  if (!isPaperPage) return null;
  const title = cleanTitle(r.title.replace(/\s*[|\-–]\s*(arXiv|OpenReview|bioRxiv|medRxiv|ACL Anthology|PLOS.*|PMC)\s*$/i, "").replace(/^\[[\d.v]+\]\s*/, ""));
  const arxivId = arxivIdFrom(r.url);
  const base = { arxivId, doi: doiFrom(r.url), title };
  return {
    id: paperIdFor(base),
    ...base,
    authors: [],
    year: null,
    venue: arxivId ? "arXiv" : host(r.url),
    abstract: r.snippet?.replace(/\s+/g, " ").trim() || null,
    abstractIsSnippet: true,
    url: arxivId ? `https://arxiv.org/abs/${arxivId}` : r.url,
    pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : null,
    siteName: host(r.url),
    citedBy: null,
    availability: "full_text",
    discoveredVia: [via],
    discoveredAt: new Date().toISOString(),
  };
}

function merge(a: Paper, b: Paper): Paper {
  return {
    ...a,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    year: a.year ?? b.year,
    venue: a.venue ?? b.venue,
    abstract: (a.abstract?.length ?? 0) >= (b.abstract?.length ?? 0) ? a.abstract : b.abstract,
    pdfUrl: a.pdfUrl ?? b.pdfUrl,
    citedBy: a.citedBy ?? b.citedBy,
    arxivId: a.arxivId ?? b.arxivId,
    doi: a.doi ?? b.doi,
    availability: a.availability === "full_text" || b.availability === "full_text" ? "full_text" : a.availability,
    discoveredVia: [...new Set([...a.discoveredVia, ...b.discoveredVia])],
  };
}

/** Pulls full abstracts + authors for arXiv papers (public Atom API, metadata only). */
async function enrichFromArxiv(papers: Paper[]) {
  const ids = papers.filter((p) => p.arxivId && (p.abstractIsSnippet || !p.authors.length)).map((p) => p.arxivId!);
  if (!ids.length) return;
  try {
    const res = await fetch(`https://export.arxiv.org/api/query?id_list=${ids.slice(0, 40).join(",")}&max_results=40`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Kensho/0.1 (research reader)" },
    });
    if (!res.ok) return;
    const xml = await res.text();
    for (const entry of xml.split("<entry>").slice(1)) {
      const id = arxivIdFrom(entry.match(/<id>([^<]+)<\/id>/)?.[1]);
      const p = papers.find((x) => x.arxivId === id);
      if (!p) continue;
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim();
      const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
      const published = entry.match(/<published>(\d{4})/)?.[1];
      if (summary) {
        p.abstract = decodeXml(summary);
        p.abstractIsSnippet = false;
      }
      if (authors.length) p.authors = authors.map(decodeXml);
      if (!p.year && published) p.year = Number(published);
      p.discoveredVia = [...new Set([...p.discoveredVia, "arxiv·metadata"])];
    }
  } catch {
    // Enrichment is best-effort; TinyFish metadata stands on its own.
  }
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** Real progress from the discovery run, streamed to the search page as it happens. */
export type DiscoverEvent =
  | { type: "start"; sources: string[] }
  | { type: "source"; label: string; ok: boolean; count: number; error?: string }
  | { type: "stage"; text: string };

export async function discover(rawQuery: string, opts: { fresh?: boolean; onEvent?: (e: DiscoverEvent) => void } = {}): Promise<SearchResponse> {
  const emit = opts.onEvent ?? (() => {});
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 200);
  const queryKey = query.toLowerCase();

  if (!opts.fresh) {
    const cached = getSearch(queryKey, CACHE_MS);
    if (cached) {
      return { query, papers: getPapers(cached.paperIds), sources: cached.sources, dedupedFrom: cached.dedupedFrom, cached: true };
    }
  }

  const purpose = `Find academic research papers that explain or advance: ${query}. Prefer foundational, well-cited and open-access papers suitable for a university student.`;
  const calls: { label: string; via: string; run: () => Promise<SearchResult[]>; map: (r: SearchResult, via: string) => Paper | null }[] = [
    {
      label: "TinyFish research index · page 1",
      via: "tinyfish·research_paper",
      run: () => search({ query, domain_type: "research_paper", purpose }),
      map: fromResearchResult,
    },
    {
      label: "TinyFish research index · page 2",
      via: "tinyfish·research_paper",
      run: () => search({ query, domain_type: "research_paper", purpose, page: 1 }),
      map: fromResearchResult,
    },
    {
      label: "TinyFish web · open repositories",
      via: "tinyfish·open_repositories",
      run: () => search({ query: `${query} paper`, include_domains: OPEN_REPOSITORIES.join(","), purpose }),
      map: fromRepositoryResult,
    },
  ];

  emit({ type: "start", sources: calls.map((c) => c.label) });
  const sources: SearchResponse["sources"] = calls.map((c) => ({ label: c.label, ok: false, count: 0 }));
  const all: Paper[] = [];
  // Each source reports the moment it finishes, so the UI shows real progress.
  await Promise.all(
    calls.map(async (c, i) => {
      try {
        const mapped = (await c.run()).map((r) => c.map(r, c.via)).filter((p): p is Paper => !!p);
        sources[i] = { label: c.label, ok: true, count: mapped.length };
        all.push(...mapped);
      } catch (e) {
        sources[i] = { label: c.label, ok: false, count: 0, error: String((e as Error)?.message ?? e).slice(0, 200) };
      }
      emit({ type: "source", ...sources[i] });
    }),
  );

  if (sources.every((s) => !s.ok)) {
    throw new Error(sources[0]?.error ?? "TinyFish search failed");
  }

  emit({ type: "stage", text: `Merging ${all.length} results and removing duplicates` });
  // Dedupe by arXiv id / DOI / normalized title, then a second pass on title alone
  // because the same paper often appears once with an id and once without.
  const byKey = new Map<string, Paper>();
  for (const p of all) {
    const k = paperKey(p);
    byKey.set(k, byKey.has(k) ? merge(byKey.get(k)!, p) : p);
  }
  const byTitle = new Map<string, Paper>();
  for (const p of byKey.values()) {
    const k = normTitle(p.title);
    if (!k) continue;
    byTitle.set(k, byTitle.has(k) ? merge(byTitle.get(k)!, p) : p);
  }
  const papers = [...byTitle.values()].map((p) => ({ ...p, id: paperIdFor(p) }));

  if (papers.some((p) => p.arxivId)) emit({ type: "stage", text: "Fetching full abstracts for arXiv papers" });
  await enrichFromArxiv(papers);
  const stored = papers.map(upsertPaper);
  saveSearch(queryKey, query, stored.map((p) => p.id), sources, all.length);

  return { query, papers: stored, sources, dedupedFrom: all.length, cached: false };
}

/** Related research: TinyFish research search seeded with the paper's own title. */
export async function related(paper: Paper): Promise<Paper[]> {
  const results = await search({
    query: paper.title,
    domain_type: "research_paper",
    purpose: `Find papers closely related to, building on, or cited by "${paper.title}".`,
  });
  const out: Paper[] = [];
  const seen = new Set([normTitle(paper.title)]);
  for (const r of results) {
    const p = fromResearchResult(r, "tinyfish·related");
    if (!p || seen.has(normTitle(p.title))) continue;
    seen.add(normTitle(p.title));
    out.push(p);
  }
  await enrichFromArxiv(out);
  return out.slice(0, 6).map(upsertPaper);
}
