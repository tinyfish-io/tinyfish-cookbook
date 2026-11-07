import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Acquisition, Analysis, Job, Paper, Story } from "@/lib/types";

// Single-file SQLite via Node's built-in driver: no native build step, survives restarts.
// JSON columns keep the schema flexible while the pipeline evolves.

const globalForDb = globalThis as unknown as { __kenshoDb?: DatabaseSync };

function open(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "kensho.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS searches (
      query_key TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      paper_ids TEXT NOT NULL,
      sources TEXT NOT NULL,
      deduped_from INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed (
      paper_id TEXT PRIMARY KEY,
      acquisition TEXT,
      analysis TEXT,
      story TEXT,
      model TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      paper_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  return db;
}

export const db = globalForDb.__kenshoDb ?? (globalForDb.__kenshoDb = open());

const now = () => new Date().toISOString();

/* papers */

export function upsertPaper(p: Paper) {
  const existing = getPaper(p.id);
  // Merge discovery provenance instead of overwriting it.
  const merged: Paper = existing
    ? {
        ...existing,
        ...p,
        abstract: existing.abstractIsSnippet && !p.abstractIsSnippet ? p.abstract : existing.abstract ?? p.abstract,
        abstractIsSnippet: existing.abstractIsSnippet && p.abstractIsSnippet,
        discoveredVia: [...new Set([...existing.discoveredVia, ...p.discoveredVia])],
        discoveredAt: existing.discoveredAt,
        // A confirmed status (from actually reading the paper) always beats a discovery-time guess.
        availability: existing.availabilityConfirmed && !p.availabilityConfirmed ? existing.availability : existing.availability !== "unknown" && p.availability === "unknown" ? existing.availability : p.availability,
        availabilityConfirmed: existing.availabilityConfirmed || p.availabilityConfirmed,
      }
    : p;
  db.prepare(
    `INSERT INTO papers (id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(merged.id, JSON.stringify(merged), now());
  return merged;
}

export function getPaper(id: string): Paper | null {
  const row = db.prepare(`SELECT data FROM papers WHERE id = ?`).get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Paper) : null;
}

export function getPapers(ids: string[]): Paper[] {
  return ids.map(getPaper).filter((p): p is Paper => !!p);
}

/* searches */

export function saveSearch(queryKey: string, query: string, paperIds: string[], sources: unknown, dedupedFrom: number) {
  db.prepare(
    `INSERT INTO searches (query_key, query, paper_ids, sources, deduped_from, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(query_key) DO UPDATE SET query = excluded.query, paper_ids = excluded.paper_ids,
       sources = excluded.sources, deduped_from = excluded.deduped_from, created_at = excluded.created_at`,
  ).run(queryKey, query, JSON.stringify(paperIds), JSON.stringify(sources), dedupedFrom, now());
}

export function getSearch(queryKey: string, maxAgeMs: number) {
  const row = db.prepare(`SELECT * FROM searches WHERE query_key = ?`).get(queryKey) as
    | { query: string; paper_ids: string; sources: string; deduped_from: number; created_at: string }
    | undefined;
  if (!row || Date.now() - Date.parse(row.created_at) > maxAgeMs) return null;
  return {
    query: row.query,
    paperIds: JSON.parse(row.paper_ids) as string[],
    sources: JSON.parse(row.sources),
    dedupedFrom: row.deduped_from,
  };
}

export function recentSearches(limit = 8): { query: string; count: number; at: string }[] {
  const rows = db
    .prepare(`SELECT query, paper_ids, created_at FROM searches ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as { query: string; paper_ids: string; created_at: string }[];
  return rows.map((r) => ({ query: r.query, count: (JSON.parse(r.paper_ids) as string[]).length, at: r.created_at }));
}

/* processed */

type ProcessedRow = { acquisition: string | null; analysis: string | null; story: string | null; model: string | null };

export function getProcessed(paperId: string) {
  const row = db.prepare(`SELECT acquisition, analysis, story, model FROM processed WHERE paper_id = ?`).get(paperId) as
    | ProcessedRow
    | undefined;
  return {
    acquisition: row?.acquisition ? (JSON.parse(row.acquisition) as Acquisition) : null,
    analysis: row?.analysis ? (JSON.parse(row.analysis) as Analysis) : null,
    story: row?.story ? (JSON.parse(row.story) as Story) : null,
    model: row?.model ?? null,
  };
}

export function saveProcessed(
  paperId: string,
  patch: { acquisition?: Acquisition | null; analysis?: Analysis | null; story?: Story | null; model?: string },
) {
  const cur = getProcessed(paperId);
  const next = { ...cur, ...patch };
  db.prepare(
    `INSERT INTO processed (paper_id, acquisition, analysis, story, model, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(paper_id) DO UPDATE SET acquisition = excluded.acquisition, analysis = excluded.analysis,
       story = excluded.story, model = excluded.model, updated_at = excluded.updated_at`,
  ).run(
    paperId,
    next.acquisition ? JSON.stringify(next.acquisition) : null,
    next.analysis ? JSON.stringify(next.analysis) : null,
    next.story ? JSON.stringify(next.story) : null,
    next.model ?? null,
    now(),
  );
}

/** Papers that have at least one finished chapter — the real "recently drawn" shelf. */
export function recentlyDrawn(limit = 6): { paper: Paper; chapters: number; at: string }[] {
  const rows = db
    .prepare(`SELECT paper_id, story, updated_at FROM processed WHERE story IS NOT NULL ORDER BY updated_at DESC LIMIT ?`)
    .all(limit * 2) as { paper_id: string; story: string; updated_at: string }[];
  const out: { paper: Paper; chapters: number; at: string }[] = [];
  for (const r of rows) {
    const paper = getPaper(r.paper_id);
    const chapters = (JSON.parse(r.story) as Story).chapters.filter(Boolean).length;
    if (paper && chapters > 0) out.push({ paper, chapters, at: r.updated_at });
    if (out.length >= limit) break;
  }
  return out;
}

/* jobs */

export function getJob(paperId: string): Job | null {
  const row = db.prepare(`SELECT data FROM jobs WHERE paper_id = ?`).get(paperId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Job) : null;
}

export function saveJob(job: Job) {
  db.prepare(
    `INSERT INTO jobs (paper_id, data) VALUES (?, ?) ON CONFLICT(paper_id) DO UPDATE SET data = excluded.data`,
  ).run(job.paperId, JSON.stringify({ ...job, updatedAt: now() }));
}
