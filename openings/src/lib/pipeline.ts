import { searchPostings } from "./discover";
import { normalizeSlug, readBoards, type BoardCandidate } from "./boards";
import { readPages, type PageRead } from "./read";
import { AgentBudget, agentReadPosting, agentSearchPortal, type AgentEvent, type AgentRunLog } from "./agent";
import { findPortal } from "./portals";
import { classifyUrl } from "./ats";
import { firecrawlEnabled, firecrawlScrapeMany } from "./firecrawl";
import { extractWithRules, isClearlySenior, prettySlug, seniorityOf } from "./extract/rules";
import { BATCH_SIZE, extractBatchWithLlm, llmAvailable } from "./extract/llm";
import { jobId, type Job } from "./job";
import { matchLocation, rankJobs, type FilteredJob, type RankedJob } from "./rank";
import type { Candidate, Preferences } from "./types";

export type Stage = "search" | "boards" | "agent" | "fetch" | "firecrawl" | "extract" | "rank";

export interface PipelineStats {
  ms: Record<Stage, number>;
  searchFound: number;
  boardListed: number;
  boardRelevant: number;
  read: number;
  readFailed: number;
  llm: boolean;
  llmFailed: number;
  llmDisabledReason: string | null;
  agent: { budget: number; used: number; runs: AgentRunLog[] };
  firecrawl: { enabled: boolean; searchFallbackHits: number; scrapeAttempts: number; scraped: number };
  rank: { skippedBeforeRead: number; extracted: number; unique: number; filtered: number; kept: number };
}

export interface PipelineResult {
  jobs: RankedJob[];
  filtered: FilteredJob[];
  stats: PipelineStats;
}

export interface PipelineOptions {
  readLimit?: number;
  /** Max metered Agent runs for this pipeline run (0 = never call Agent). */
  agentRuns?: number;
  /** `done` marks the message that finishes a stage (so a UI can tick it off). */
  onProgress?: (stage: Stage, message: string, done: boolean) => void;
  onAgentEvent?: (event: AgentEvent) => void;
}

/** Usual cap on Firecrawl render-fallback scrapes per run (1 credit each). */
const FIRECRAWL_MAX_SCRAPES = 8;

/** Fetch text shorter than this is a JS shell (e.g. Workday's "Careers at Red Hat"), not a posting. */
export const SHELL_CHARS = 600;

const SEARCH_TERM: Record<Preferences["seniority"], string> = { internship: "intern", new_grad: "new grad", any: "" };

const STOPWORDS = new Set(["and", "the", "for", "with", "role", "job", "jobs"]);

/** Cheap title filter for board listings (boards list every role at the company). */
export function titleMatches(title: string, prefs: Preferences): boolean {
  if (prefs.seniority !== "any" && seniorityOf(title) !== prefs.seniority) return false;
  const tokens = prefs.role.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const t = title.toLowerCase();
  // 6-char stems so "engineer" matches "engineering", "develop" matches "developer".
  return tokens.length === 0 || tokens.some((w) => t.includes(w.slice(0, 6)));
}

/**
 * Choose which candidates to spend Fetch reads on. Watchlist boards get up to half the slots,
 * shared round-robin across companies (one big board can't crowd out the rest); Search fills
 * the remainder. One entry per posting URL.
 */
export function pickToRead(board: Candidate[], searched: Candidate[], limit: number): Candidate[] {
  const byCompany = new Map<string, Candidate[]>();
  for (const c of board) byCompany.set(c.company ?? "", [...(byCompany.get(c.company ?? "") ?? []), c]);
  const queues = [...byCompany.values()];
  const boardPick: Candidate[] = [];
  const boardCap = Math.ceil(limit / 2);
  while (boardPick.length < boardCap && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && boardPick.length < boardCap) boardPick.push(q.shift()!);
  }

  const seen = new Set<string>();
  const out: Candidate[] = [];
  const leftovers = queues.flat();
  for (const c of [...boardPick, ...searched, ...leftovers]) {
    const id = jobId(c.url);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
    if (out.length === limit) break;
  }
  return out;
}

export async function runPipeline(prefs: Preferences, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const readLimit = opts.readLimit ?? 20;
  const onProgress = opts.onProgress ?? (() => {});
  const progress = (stage: Stage, message: string) => onProgress(stage, message, false);
  const finished = (stage: Stage, message: string) => onProgress(stage, message, true);
  const ms = { search: 0, boards: 0, agent: 0, fetch: 0, firecrawl: 0, extract: 0, rank: 0 };
  const budget = new AgentBudget(opts.agentRuns ?? 0, opts.onAgentEvent);
  const addAgentMs = async <T>(p: Promise<T>) => {
    const t0 = Date.now();
    try {
      return await p;
    } finally {
      ms.agent += Date.now() - t0;
    }
  };
  const timed = async <T>(stage: Stage, p: Promise<T>) => {
    const t0 = Date.now();
    try {
      return await p;
    } finally {
      ms[stage] = Date.now() - t0;
    }
  };

  // 1+2. Discover: Search across ATS boards, and read watchlist companies' boards, in parallel.
  progress("search", "Searching job boards…");
  if (prefs.companies.length) progress("boards", `Reading boards for ${prefs.companies.join(", ")}…`);
  const [searched, listed] = await Promise.all([
    timed("search", searchPostings(prefs)),
    timed("boards", readBoards(prefs.companies)),
  ]);
  const relevantBoard = listed.filter((c) => titleMatches(c.title, prefs));
  finished("search", `Search found ${searched.length} postings`);
  if (prefs.companies.length) finished("boards", `Boards listed ${listed.length} roles, ${relevantBoard.length} relevant`);

  // 2b. Agent on portals: watchlist companies that aren't on Greenhouse/Lever usually use a JS-app
  // portal (Ashby, Workday). Search finds the portal (free); Agent uses its search box (metered).
  const onBoards = new Set(listed.map((c) => c.company));
  const missing = [...new Set(prefs.companies.map(normalizeSlug).filter(Boolean))].filter((s) => !onBoards.has(s));
  if (missing.length && budget.remaining > 0) {
    progress("agent", `Looking for careers portals for ${missing.join(", ")}…`);
    const portals = await addAgentMs(
      Promise.all(missing.map(async (slug) => ({ slug, root: await findPortal(slug).catch(() => null) }))),
    );
    const found = portals.filter((p) => p.root);
    const term = [prefs.role, SEARCH_TERM[prefs.seniority]].filter(Boolean).join(" ");
    const runs = found.filter(() => budget.reserve());
    if (runs.length) progress("agent", `Agent searching ${runs.map((p) => p.slug).join(", ")} for "${term}" (usually 1–3 min)…`);
    const agentListed = await addAgentMs(
      Promise.all(
        runs.map(async ({ slug, root }) =>
          (await agentSearchPortal(budget, root!, term)).map(
            (l): BoardCandidate => ({
              url: l.url,
              title: l.title,
              snippet: "",
              ...classifyUrl(l.url),
              company: slug,
              companyName: prettySlug(slug),
              location: l.location || null,
              foundBy: "agent",
            }),
          ),
        ),
      ),
    );
    const relevantAgent = agentListed.flat().filter((c) => titleMatches(c.title, prefs));
    relevantBoard.push(...relevantAgent);
    const notFound = portals.filter((p) => !p.root).map((p) => p.slug);
    finished(
      "agent",
      `Agent listed ${relevantAgent.length} relevant roles` + (notFound.length ? ` · no portal found for ${notFound.join(", ")}` : ""),
    );
  }

  // Don't spend reads on what we can already rule out: search results whose title is plainly the
  // wrong level ("Senior …", "Director …"), and board postings whose listed location is elsewhere.
  const searchedRelevant =
    prefs.seniority === "any" ? searched : searched.filter((c) => !isClearlySenior(c.title));
  const boardInPlace = relevantBoard.filter(
    (c) => !c.location || matchLocation({ location: c.location, workplace: "unknown" }, prefs.locations) !== "mismatch",
  );
  const skippedBeforeRead = searched.length - searchedRelevant.length + (relevantBoard.length - boardInPlace.length);
  const toRead: (Candidate | BoardCandidate)[] = pickToRead(boardInPlace, searchedRelevant, readLimit);

  // 3. Fetch: read each posting.
  progress("fetch", `Reading ${toRead.length} postings…`);
  const pages = await timed("fetch", readPages(toRead.map((c) => c.url)));
  const pageById = new Map(pages.filter((p) => p.text.length >= SHELL_CHARS).map((p) => [jobId(p.url), p]));
  finished("fetch", `Read ${pageById.size}/${toRead.length} postings`);

  // 3b. Firecrawl on shells: pages TinyFish Fetch couldn't render get one cheap retry on Firecrawl.
  const readByFirecrawl = new Set<string>();
  // If Fetch read nothing at all, TinyFish is down rather than a few pages being JS shells:
  // let Firecrawl cover the whole read budget instead of the usual cap.
  const fcCap = pageById.size === 0 ? readLimit : FIRECRAWL_MAX_SCRAPES;
  const fcTargets = firecrawlEnabled() ? toRead.filter((c) => !pageById.has(jobId(c.url))).slice(0, fcCap) : [];
  if (fcTargets.length) {
    progress("firecrawl", `Firecrawl rendering ${fcTargets.length} page${fcTargets.length > 1 ? "s" : ""} Fetch couldn't…`);
    const rendered = await timed("firecrawl", firecrawlScrapeMany(fcTargets.map((c) => c.url)));
    for (const page of rendered) {
      if (page.text.length < SHELL_CHARS) continue;
      pageById.set(jobId(page.url), page);
      readByFirecrawl.add(jobId(page.url));
    }
    finished("firecrawl", `Firecrawl rendered ${readByFirecrawl.size}/${fcTargets.length}`);
  }

  // 3c. Agent on what's still unreadable (missing or a tiny JS shell).
  const readByAgent = new Set<string>();
  const shells = toRead.filter((c) => !pageById.has(jobId(c.url)));
  const shellRuns = shells.filter(() => budget.reserve());
  if (shellRuns.length) {
    progress("agent", `Agent reading ${shellRuns.length} posting${shellRuns.length > 1 ? "s" : ""} Fetch couldn't render (usually under a minute)…`);
    await addAgentMs(
      Promise.all(
        shellRuns.map(async (c) => {
          const posting = await agentReadPosting(budget, c.url);
          if (!posting) return;
          const text = [`# ${posting.title}`, posting.company, posting.location, posting.pay, "", posting.description].join("\n");
          const page: PageRead = { url: c.url, finalUrl: c.url, title: posting.title, text };
          pageById.set(jobId(c.url), page);
          readByAgent.add(jobId(c.url));
        }),
      ),
    );
    finished("agent", `Agent read ${readByAgent.size}/${shellRuns.length} postings`);
  }

  // 4. Extract: rules on every job; then the LLM in batches, when the AI Gateway is configured.
  let useLlm = llmAvailable();
  let llmFailed = 0;
  let llmDisabledReason: string | null = null;
  progress("extract", useLlm ? "Extracting details with rules + LLM…" : "Extracting details with rules…");
  const fetchedAt = new Date().toISOString();
  const jobs: Job[] = toRead.flatMap((c) => {
    const page = pageById.get(jobId(c.url));
    if (!page) return [];
    const board = "companyName" in c ? c : null;
    const rules = extractWithRules({
      title: c.title || page.title,
      text: page.text,
      company: board ? (board.companyName ?? prettySlug(board.company)) : null,
      companyHint: prettySlug(c.company),
      location: board?.location ?? null,
    });
    const id = jobId(c.url);
    return [
      {
        ...rules,
        id,
        applyUrl: c.url,
        ats: c.ats,
        foundBy: c.foundBy,
        readBy: readByAgent.has(id) ? ("agent" as const) : readByFirecrawl.has(id) ? ("firecrawl" as const) : ("fetch" as const),
        extractedBy: "rules" as const,
        fetchedAt,
      },
    ];
  });

  if (useLlm && jobs.length) {
    const batches: Job[][] = [];
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) batches.push(jobs.slice(i, i + BATCH_SIZE));
    await timed(
      "extract",
      Promise.all(
        batches.map(async (batch) => {
          if (!useLlm) return;
          try {
            const results = await extractBatchWithLlm(
              batch.map((j) => ({ text: pageById.get(j.id)!.text, hint: j })),
            );
            results.forEach((extracted, i) => {
              if (extracted) Object.assign(batch[i], extracted, { extractedBy: "llm" });
              else llmFailed++;
            });
          } catch (err) {
            llmFailed += batch.length;
            const message = (err as Error).message;
            // Account-level failures (billing, auth, model access) will fail every call — stop trying this run.
            if (/credit card|free tier|upgrade|unauthori[sz]ed|forbidden|api key|oidc|insufficient/i.test(message)) {
              useLlm = false;
              llmDisabledReason = message;
            }
            console.warn("[extract] LLM batch failed, keeping rules results:", message);
          }
        }),
      ),
    );
  }

  finished("extract", `Extracted ${jobs.length} jobs`);

  // 5. Rank: dedupe, drop what breaks the user's hard requirements (with reasons), score the rest.
  const t0 = Date.now();
  const ranked = rankJobs(jobs, prefs, new Set(prefs.companies.map(normalizeSlug).filter(Boolean)));
  ms.rank = Date.now() - t0;
  finished(
    "rank",
    `${ranked.counts.kept} matches` +
      (ranked.counts.extracted > ranked.counts.unique ? ` · ${ranked.counts.extracted - ranked.counts.unique} duplicates merged` : "") +
      (ranked.counts.filtered ? ` · ${ranked.counts.filtered} filtered out` : ""),
  );

  const stats: PipelineStats = {
    ms,
    searchFound: searched.length,
    boardListed: listed.length,
    boardRelevant: relevantBoard.length,
    read: pageById.size,
    readFailed: toRead.length - pageById.size,
    llm: llmAvailable(),
    llmFailed,
    llmDisabledReason,
    agent: { budget: budget.max, used: budget.logs.length, runs: budget.logs },
    firecrawl: {
      enabled: firecrawlEnabled(),
      searchFallbackHits: searched.filter((c) => c.provider === "firecrawl").length,
      scrapeAttempts: fcTargets.length,
      scraped: readByFirecrawl.size,
    },
    rank: { skippedBeforeRead, ...ranked.counts },
  };
  return { jobs: ranked.jobs, filtered: ranked.filtered, stats };
}
