export type Seniority = "internship" | "new_grad" | "any";

export interface Preferences {
  role: string; // e.g. "software engineer"
  locations: string[]; // e.g. ["Toronto", "Remote"]
  seniority: Seniority;
  keywords: string[]; // e.g. ["python", "ml"]
  needsVisa: boolean;
  companies: string[]; // optional watchlist, e.g. ["notion", "roblox"]
  gradYear?: number | null; // e.g. 2027 — postings often target specific graduation years
}

export type Ats = "greenhouse" | "lever" | "ashby" | "workday" | "other";

/** A URL surfaced by discovery, before we've read the page. */
export interface Candidate {
  url: string;
  title: string;
  snippet: string;
  ats: Ats;
  company: string | null; // board slug when derivable from the URL
  foundBy: "search" | "board" | "agent";
  /** Which search provider surfaced it (Firecrawl only as a fallback). */
  provider?: "tinyfish" | "firecrawl";
}
