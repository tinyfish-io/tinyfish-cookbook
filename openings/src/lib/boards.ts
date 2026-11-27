import { fetchRaw, tinyfish } from "./tinyfish";
import type { Candidate } from "./types";

/** A board posting with the details the board listing already gives us. */
export interface BoardCandidate extends Candidate {
  location: string | null;
  companyName: string | null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

type GreenhouseFeed = { jobs?: { absolute_url: string; title: string; location?: { name?: string }; company_name?: string }[] };

/**
 * Greenhouse board JSON via Fetch's markdown output arrives either wrapped in a ``` fence or
 * with markdown escapes (`absolute\_url`) — seen both on the same endpoint. Handle either.
 */
export function parseGreenhouseFeed(text: string, slug: string): BoardCandidate[] {
  const json = text.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  let data: GreenhouseFeed;
  try {
    data = JSON.parse(json);
  } catch {
    try {
      // `\_` etc. are not valid JSON escapes, so undoing them can't corrupt real JSON escapes.
      data = JSON.parse(json.replace(/\\([_*[\]#<>`~|])/g, "$1"));
    } catch {
      return [];
    }
  }
  return (data.jobs ?? []).map((j) => ({
    url: j.absolute_url,
    title: j.title,
    snippet: "",
    ats: "greenhouse",
    company: slug,
    companyName: j.company_name ?? null,
    location: j.location?.name ?? null,
    foundBy: "board",
  }));
}

/** Lever board HTML scoped to `.posting` elements. */
export function parseLeverBoard(html: string, slug: string): BoardCandidate[] {
  const out: BoardCandidate[] = [];
  for (const block of html.split(/<div[^>]*class="posting"/).slice(1)) {
    const url = /class="posting-title"[^>]*href="([^"]+)"/.exec(block)?.[1];
    const title = /data-qa="posting-name"[^>]*>([^<]+)</.exec(block)?.[1];
    if (!url || !title) continue;
    const location = /class="[^"]*\blocation\b[^"]*"[^>]*>([^<]+)</.exec(block)?.[1] ?? null;
    const workplace = /class="[^"]*\bworkplaceTypes\b[^"]*"[^>]*>([^<]+)</.exec(block)?.[1]?.replace(/[\s—–-]+$/, "");
    out.push({
      url,
      title: decode(title.trim()),
      snippet: "",
      ats: "lever",
      company: slug,
      companyName: null,
      location: [workplace, location && decode(location.trim())].filter(Boolean).join(" · ") || null,
      foundBy: "board",
    });
  }
  return out;
}

export const normalizeSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

/**
 * TinyFish Fetch: read the full list of openings for watchlist companies.
 * We don't know which ATS a company uses, so try Greenhouse's feed and Lever's board for each
 * slug (two Fetch calls, each batching up to 10 URLs) and keep whichever answers.
 * Ashby / Workday boards are JS apps that Fetch can't list — the pipeline sends those to Agent.
 */
export async function readBoards(slugs: string[]): Promise<BoardCandidate[]> {
  const clean = [...new Set(slugs.map(normalizeSlug).filter(Boolean))].slice(0, 10);
  if (!clean.length) return [];

  const [gh, lever] = await Promise.allSettled([
    tinyfish().fetch.getContents({
      urls: clean.map((s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`),
      format: "markdown",
      ttl: 3600,
    }),
    fetchRaw({
      urls: clean.map((s) => `https://jobs.lever.co/${s}`),
      format: "html",
      include_selectors: [".posting"],
      ttl: 3600,
    }),
  ]);

  const out: BoardCandidate[] = [];
  if (gh.status === "fulfilled") {
    for (const r of gh.value.results) {
      const slug = /boards\/([^/]+)\/jobs/.exec(r.url)?.[1];
      if (slug && typeof r.text === "string") out.push(...parseGreenhouseFeed(r.text, slug));
    }
  }
  if (lever.status === "fulfilled") {
    for (const r of lever.value.results) {
      const slug = /jobs\.lever\.co\/([^/?#]+)/.exec(r.url)?.[1];
      if (slug && typeof r.text === "string") out.push(...parseLeverBoard(r.text, slug));
    }
  }
  return out;
}
