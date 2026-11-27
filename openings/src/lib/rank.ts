/**
 * Phase 3: turn extracted jobs into a shortlist.
 *   1. Dedupe  — one entry per job (same company + title + location + term).
 *   2. Filter  — hard rules the user can't want broken (wrong level, wrong place, won't sponsor).
 *                Dropped jobs are returned with a reason, never silently discarded.
 *   3. Rank    — a 0–100 score with plain-English reasons ("why it matched").
 */
import type { Job } from "./job";
import type { Preferences } from "./types";

export interface Reason {
  text: string;
  kind: "plus" | "minus" | "info";
}

export interface RankedJob extends Job {
  score: number;
  reasons: Reason[];
  duplicates: string[]; // other apply URLs for the same job
  onWatchlist: boolean;
}

export interface FilteredJob {
  title: string;
  company: string | null;
  applyUrl: string;
  reason: string;
}

const squash = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ——— 1. Dedupe ———

/** Same posting reposted on another board/URL: same company, title, location and term. */
export function dedupeKey(j: Job): string {
  return [squash(j.company), squash(j.title), squash(j.location), squash(j.term)].join("|");
}

/** How complete a record is — the fullest copy of a duplicate is the one we keep. */
function completeness(j: Job): number {
  return [j.location, j.pay, j.term, j.summary, j.company].filter(Boolean).length + j.gradYears.length + j.skills.length / 4 +
    (j.visa !== "unknown" ? 1 : 0) + (j.extractedBy === "llm" ? 1 : 0);
}

export function dedupe(jobs: Job[]): { unique: Job[]; duplicatesOf: Map<string, string[]> } {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) groups.set(dedupeKey(j), [...(groups.get(dedupeKey(j)) ?? []), j]);
  const unique: Job[] = [];
  const duplicatesOf = new Map<string, string[]>();
  for (const group of groups.values()) {
    const [best, ...rest] = [...group].sort((a, b) => completeness(b) - completeness(a));
    unique.push(best);
    duplicatesOf.set(best.id, rest.map((j) => j.applyUrl));
  }
  return { unique, duplicatesOf };
}

// ——— 2. Filter ———

// Common ways the same place is written in postings.
const LOCATION_ALIASES: Record<string, string[]> = {
  "new york": ["nyc", "new york city", "manhattan", "brooklyn", "ny"],
  "san francisco": ["sf", "bay area", "san francisco bay area"],
  "los angeles": ["la", "l.a."],
  "washington": ["dc", "d.c.", "washington dc"],
  toronto: ["gta", "greater toronto"],
  seattle: ["bellevue", "redmond"],
};

function tokensFor(location: string): string[] {
  const l = location.toLowerCase().trim();
  return [l, ...(LOCATION_ALIASES[l] ?? [])];
}

export type LocationMatch = "match" | "remote" | "unknown" | "mismatch";

export function matchLocation(job: Pick<Job, "location" | "workplace">, wanted: string[]): LocationMatch {
  if (!wanted.length) return "match";
  const wantsRemote = wanted.some((w) => /remote/i.test(w));
  const places = wanted.filter((w) => !/remote/i.test(w));
  if (wantsRemote && (job.workplace === "remote" || /\bremote\b/i.test(job.location ?? ""))) return "remote";
  if (!job.location) return "unknown";
  const hay = ` ${job.location.toLowerCase().replace(/[,;•·()/]/g, " ")} `;
  // Whole-word match so "NY" doesn't hit "Sunnyvale" and "LA" doesn't hit "Atlanta".
  const hit = places.some((p) => tokensFor(p).some((t) => hay.includes(` ${t} `) || (t.length > 3 && hay.includes(t))));
  return hit ? "match" : "mismatch";
}

/** Returns the reason a job must be dropped, or null if it stays. */
export function hardFilter(job: Job, prefs: Preferences): string | null {
  if (prefs.seniority !== "any" && job.seniority !== prefs.seniority) {
    const label = { internship: "an internship", new_grad: "a new-grad role", other: "an experienced role" }[job.seniority];
    return `Looks like ${label}, not ${prefs.seniority === "internship" ? "an internship" : "a new-grad role"}`;
  }
  if (matchLocation(job, prefs.locations) === "mismatch") return `Located in ${job.location}`;
  if (prefs.needsVisa && job.visa === "no_sponsorship") return "Says it won't sponsor visas";
  // Grad years only drop a job when the user graduates *after* every year it lists. Earlier is
  // ambiguous ("must graduate before Summer 2028" is extracted as [2028] but fits a 2027 grad), so
  // that case is kept and marked down in scoring instead.
  if (prefs.gradYear && job.gradYears.length && prefs.gradYear > Math.max(...job.gradYears)) {
    return `Targets ${job.gradYears.join("/")} graduates; you graduate ${prefs.gradYear}`;
  }
  return null;
}

// ——— 3. Rank ———

const STOPWORDS = new Set(["and", "the", "for", "with", "role", "job", "jobs"]);
const stem = (w: string) => w.slice(0, 6);

export function scoreJob(job: Job, prefs: Preferences, onWatchlist: boolean): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = 0;

  // Role fit (0–35): how many of the role's words appear in the title.
  const roleWords = prefs.role.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const title = job.title.toLowerCase();
  const hits = roleWords.filter((w) => title.includes(stem(w)));
  if (roleWords.length && hits.length === roleWords.length) {
    score += 35;
    reasons.push({ text: `Title matches "${prefs.role}"`, kind: "plus" });
  } else if (hits.length) {
    score += 20;
    reasons.push({ text: `Title partly matches "${prefs.role}"`, kind: "plus" });
  }

  // Location (0–20).
  const loc = matchLocation(job, prefs.locations);
  if (loc === "remote") {
    score += 20;
    reasons.push({ text: "Remote", kind: "plus" });
  } else if (loc === "match" && prefs.locations.length) {
    score += 20;
    reasons.push({ text: `In ${job.location}`, kind: "plus" });
  } else if (loc === "unknown") {
    score += 5;
    reasons.push({ text: "Location not stated", kind: "info" });
  }

  // Keywords (0–15): in the title, skills or summary.
  const hay = [job.title, job.summary ?? "", ...job.skills].join(" ").toLowerCase();
  const kw = prefs.keywords.filter((k) => hay.includes(k.toLowerCase()));
  if (kw.length) {
    score += Math.min(15, kw.length * 5);
    reasons.push({ text: `Mentions ${kw.join(", ")}`, kind: "plus" });
  }

  // Graduation year (0–10, or −10 when it may not fit).
  if (prefs.gradYear && job.gradYears.includes(prefs.gradYear)) {
    score += 10;
    reasons.push({ text: `Wants ${prefs.gradYear} graduates`, kind: "plus" });
  } else if (prefs.gradYear && job.gradYears.length) {
    score -= 10;
    reasons.push({ text: `Mentions ${job.gradYears.join("/")} graduates — check eligibility`, kind: "minus" });
  }

  // Visa (0–10), only when the user needs it.
  if (prefs.needsVisa) {
    if (job.visa === "sponsors") {
      score += 10;
      reasons.push({ text: "Sponsors visas", kind: "plus" });
    } else {
      reasons.push({ text: "Visa sponsorship not stated", kind: "info" });
    }
  }

  // Watchlist (0–5) and useful details (0–5).
  if (onWatchlist) {
    score += 5;
    reasons.push({ text: "On your watchlist", kind: "plus" });
  }
  if (job.pay) {
    score += 3;
    reasons.push({ text: `Pay listed: ${job.pay}`, kind: "info" });
  }
  if (job.term) score += 2;

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export interface RankResult {
  jobs: RankedJob[];
  filtered: FilteredJob[];
  counts: { extracted: number; unique: number; filtered: number; kept: number };
}

export function rankJobs(jobs: Job[], prefs: Preferences, watchlist: Set<string>): RankResult {
  const { unique, duplicatesOf } = dedupe(jobs);
  const kept: RankedJob[] = [];
  const filtered: FilteredJob[] = [];
  for (const job of unique) {
    const reason = hardFilter(job, prefs);
    if (reason) {
      filtered.push({ title: job.title, company: job.company, applyUrl: job.applyUrl, reason });
      continue;
    }
    const onWatchlist = [...watchlist].some((w) => squash(job.company).includes(squash(w).slice(0, 5)) || squash(job.applyUrl).includes(squash(w)));
    kept.push({ ...job, ...scoreJob(job, prefs, onWatchlist), duplicates: duplicatesOf.get(job.id) ?? [], onWatchlist });
  }
  kept.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { jobs: kept, filtered, counts: { extracted: jobs.length, unique: unique.length, filtered: filtered.length, kept: kept.length } };
}
