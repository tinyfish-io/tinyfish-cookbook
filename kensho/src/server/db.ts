import "server-only";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type RedisClientType } from "redis";
import type { Acquisition, Analysis, Job, Paper, Story } from "@/lib/types";

// Storage for papers, searches, processed manga and jobs. Two backends behind one async API:
//  - SQLite (Node's built-in driver) for local development, and as a fallback on Vercel, where it
//    runs from a /tmp copy seeded with the bundled database (each server instance has its own copy).
//  - Upstash Redis over its REST API, used whenever its env vars are present. On Vercel this is the
//    shared, durable store, so searches and background jobs work across server instances.
// Values are JSON documents either way, so the schema can evolve with the pipeline.

export type ProcessedRecord = { acquisition: Acquisition | null; analysis: Analysis | null; story: Story | null; model: string | null };
type SearchRecord = { query: string; paperIds: string[]; sources: unknown; dedupedFrom: number; createdAt: string };

const now = () => new Date().toISOString();
const EMPTY_PROCESSED: ProcessedRecord = { acquisition: null, analysis: null, story: null, model: null };

/* ───────────── Redis (Upstash REST or a redis:// URL) ───────────── */

// Vercel's Upstash integration may add a custom prefix (e.g. STORAGE_KV_REST_API_URL), so match by suffix.
// The read-only token is skipped: the app needs to write.
const envBySuffix = (...suffixes: string[]) => {
  for (const s of suffixes) {
    if (process.env[s]) return process.env[s];
    const key = Object.keys(process.env).find((k) => k.endsWith(`_${s}`) && !k.includes("READ_ONLY") && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
};
const REDIS_URL = envBySuffix("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = envBySuffix("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
// A plain connection string (redis:// or rediss://), as Vercel's Redis integration provides.
const REDIS_TCP_URL = REDIS_URL && REDIS_TOKEN ? undefined : envBySuffix("REDIS_URL", "KV_URL");
export const storageBackend = (REDIS_URL && REDIS_TOKEN) || REDIS_TCP_URL ? "redis" : "sqlite";

// One connection per server instance, reused across requests.
const globalForRedis = globalThis as unknown as { __kenshoRedis?: Promise<RedisClientType> };
function tcpClient() {
  return (globalForRedis.__kenshoRedis ??= (async () => {
    const client = createClient({ url: REDIS_TCP_URL }) as RedisClientType;
    client.on("error", () => {}); // reconnects on its own; failed commands still throw
    await client.connect();
    return client;
  })().catch((e) => {
    globalForRedis.__kenshoRedis = undefined;
    throw new Error(`Storage error: ${(e as Error).message}`);
  }));
}

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  if (REDIS_TCP_URL) return (await (await tcpClient()).sendCommand(cmd.map(String))) as T;
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(`Storage error: ${json.error ?? res.status}`);
  return json.result as T;
}
const rGet = async <T>(key: string): Promise<T | null> => {
  const v = await redis<string | null>("GET", key);
  return v ? (JSON.parse(v) as T) : null;
};
const rSet = (key: string, value: unknown) => redis("SET", key, JSON.stringify(value));
const rMGet = async <T>(keys: string[]): Promise<(T | null)[]> =>
  keys.length ? (await redis<(string | null)[]>("MGET", ...keys)).map((v) => (v ? (JSON.parse(v) as T) : null)) : [];

/* ───────────── SQLite ───────────── */

const globalForDb = globalThis as unknown as { __kenshoDb?: DatabaseSync };

function sqliteDir() {
  const bundled = path.join(process.cwd(), "data");
  // Vercel's filesystem is read-only outside /tmp: run from a copy seeded with the bundled data.
  if (!process.env.VERCEL) return bundled;
  const tmp = "/tmp/kensho";
  mkdirSync(tmp, { recursive: true });
  if (!existsSync(path.join(tmp, "kensho.db"))) {
    for (const f of ["kensho.db", "kensho.db-wal", "kensho.db-shm"]) {
      const src = path.join(bundled, f);
      if (existsSync(src)) copyFileSync(src, path.join(tmp, f));
    }
  }
  return tmp;
}

function openSqlite(): DatabaseSync {
  const dir = sqliteDir();
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "kensho.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS papers (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS searches (
      query_key TEXT PRIMARY KEY, query TEXT NOT NULL, paper_ids TEXT NOT NULL,
      sources TEXT NOT NULL, deduped_from INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed (
      paper_id TEXT PRIMARY KEY, acquisition TEXT, analysis TEXT, story TEXT, model TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (paper_id TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);
  return db;
}

const sql = () => (globalForDb.__kenshoDb ??= openSqlite());

/* ───────────── papers ───────────── */

function mergePaper(existing: Paper | null, p: Paper): Paper {
  if (!existing) return p;
  // Merge discovery provenance instead of overwriting it.
  return {
    ...existing,
    ...p,
    abstract: existing.abstractIsSnippet && !p.abstractIsSnippet ? p.abstract : existing.abstract ?? p.abstract,
    abstractIsSnippet: existing.abstractIsSnippet && p.abstractIsSnippet,
    discoveredVia: [...new Set([...existing.discoveredVia, ...p.discoveredVia])],
    discoveredAt: existing.discoveredAt,
    // A confirmed status (from actually reading the paper) always beats a discovery-time guess.
    availability:
      existing.availabilityConfirmed && !p.availabilityConfirmed
        ? existing.availability
        : existing.availability !== "unknown" && p.availability === "unknown"
          ? existing.availability
          : p.availability,
    availabilityConfirmed: existing.availabilityConfirmed || p.availabilityConfirmed,
  };
}

export async function getPaper(id: string): Promise<Paper | null> {
  if (storageBackend === "redis") return rGet<Paper>(`paper:${id}`);
  const row = sql().prepare(`SELECT data FROM papers WHERE id = ?`).get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Paper) : null;
}

export async function getPapers(ids: string[]): Promise<Paper[]> {
  if (storageBackend === "redis") return (await rMGet<Paper>(ids.map((id) => `paper:${id}`))).filter((p): p is Paper => !!p);
  return (await Promise.all(ids.map(getPaper))).filter((p): p is Paper => !!p);
}

export async function upsertPaper(p: Paper): Promise<Paper> {
  const merged = mergePaper(await getPaper(p.id), p);
  if (storageBackend === "redis") {
    await rSet(`paper:${merged.id}`, merged);
  } else {
    sql()
      .prepare(`INSERT INTO papers (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
      .run(merged.id, JSON.stringify(merged), now());
  }
  return merged;
}

/* ───────────── searches ───────────── */

export async function saveSearch(queryKey: string, query: string, paperIds: string[], sources: unknown, dedupedFrom: number) {
  if (storageBackend === "redis") {
    const rec: SearchRecord = { query, paperIds, sources, dedupedFrom, createdAt: now() };
    await rSet(`search:${queryKey}`, rec);
    await redis("ZADD", "searches", Date.now(), queryKey);
    return;
  }
  sql()
    .prepare(
      `INSERT INTO searches (query_key, query, paper_ids, sources, deduped_from, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(query_key) DO UPDATE SET query = excluded.query, paper_ids = excluded.paper_ids,
         sources = excluded.sources, deduped_from = excluded.deduped_from, created_at = excluded.created_at`,
    )
    .run(queryKey, query, JSON.stringify(paperIds), JSON.stringify(sources), dedupedFrom, now());
}

export async function getSearch(queryKey: string, maxAgeMs: number) {
  if (storageBackend === "redis") {
    const rec = await rGet<SearchRecord>(`search:${queryKey}`);
    if (!rec || Date.now() - Date.parse(rec.createdAt) > maxAgeMs) return null;
    return { query: rec.query, paperIds: rec.paperIds, sources: rec.sources, dedupedFrom: rec.dedupedFrom };
  }
  const row = sql().prepare(`SELECT * FROM searches WHERE query_key = ?`).get(queryKey) as
    | { query: string; paper_ids: string; sources: string; deduped_from: number; created_at: string }
    | undefined;
  if (!row || Date.now() - Date.parse(row.created_at) > maxAgeMs) return null;
  return { query: row.query, paperIds: JSON.parse(row.paper_ids) as string[], sources: JSON.parse(row.sources), dedupedFrom: row.deduped_from };
}

export async function recentSearches(limit = 8): Promise<{ query: string; count: number; at: string }[]> {
  if (storageBackend === "redis") {
    const keys = await redis<string[]>("ZRANGE", "searches", 0, limit - 1, "REV");
    return (await rMGet<SearchRecord>(keys.map((k) => `search:${k}`)))
      .filter((r): r is SearchRecord => !!r)
      .map((r) => ({ query: r.query, count: r.paperIds.length, at: r.createdAt }));
  }
  const rows = sql()
    .prepare(`SELECT query, paper_ids, created_at FROM searches ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as { query: string; paper_ids: string; created_at: string }[];
  return rows.map((r) => ({ query: r.query, count: (JSON.parse(r.paper_ids) as string[]).length, at: r.created_at }));
}

/* ───────────── processed ───────────── */

export async function getProcessed(paperId: string): Promise<ProcessedRecord> {
  if (storageBackend === "redis") return (await rGet<ProcessedRecord>(`processed:${paperId}`)) ?? { ...EMPTY_PROCESSED };
  const row = sql().prepare(`SELECT acquisition, analysis, story, model FROM processed WHERE paper_id = ?`).get(paperId) as
    | { acquisition: string | null; analysis: string | null; story: string | null; model: string | null }
    | undefined;
  return {
    acquisition: row?.acquisition ? (JSON.parse(row.acquisition) as Acquisition) : null,
    analysis: row?.analysis ? (JSON.parse(row.analysis) as Analysis) : null,
    story: row?.story ? (JSON.parse(row.story) as Story) : null,
    model: row?.model ?? null,
  };
}

export async function saveProcessed(paperId: string, patch: Partial<Omit<ProcessedRecord, "model">> & { model?: string }) {
  const next = { ...(await getProcessed(paperId)), ...patch };
  if (storageBackend === "redis") {
    await rSet(`processed:${paperId}`, next);
    if (next.story?.chapters.some(Boolean)) await redis("ZADD", "drawn", Date.now(), paperId);
    return;
  }
  sql()
    .prepare(
      `INSERT INTO processed (paper_id, acquisition, analysis, story, model, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(paper_id) DO UPDATE SET acquisition = excluded.acquisition, analysis = excluded.analysis,
         story = excluded.story, model = excluded.model, updated_at = excluded.updated_at`,
    )
    .run(
      paperId,
      next.acquisition ? JSON.stringify(next.acquisition) : null,
      next.analysis ? JSON.stringify(next.analysis) : null,
      next.story ? JSON.stringify(next.story) : null,
      next.model ?? null,
      now(),
    );
}

/** Papers that have at least one finished chapter — the real "recently drawn" shelf. */
export async function recentlyDrawn(limit = 6): Promise<{ paper: Paper; chapters: number; at: string }[]> {
  let rows: { paperId: string; story: Story | null; at: string }[];
  if (storageBackend === "redis") {
    const ids = await redis<string[]>("ZRANGE", "drawn", 0, limit * 2 - 1, "REV");
    const recs = await rMGet<ProcessedRecord>(ids.map((id) => `processed:${id}`));
    rows = ids.map((paperId, i) => ({ paperId, story: recs[i]?.story ?? null, at: "" }));
  } else {
    rows = (
      sql()
        .prepare(`SELECT paper_id, story, updated_at FROM processed WHERE story IS NOT NULL ORDER BY updated_at DESC LIMIT ?`)
        .all(limit * 2) as { paper_id: string; story: string; updated_at: string }[]
    ).map((r) => ({ paperId: r.paper_id, story: JSON.parse(r.story) as Story, at: r.updated_at }));
  }
  const papers = await getPapers(rows.map((r) => r.paperId));
  const out: { paper: Paper; chapters: number; at: string }[] = [];
  for (const r of rows) {
    const paper = papers.find((p) => p.id === r.paperId);
    const chapters = r.story?.chapters.filter(Boolean).length ?? 0;
    if (paper && chapters > 0) out.push({ paper, chapters, at: r.at });
    if (out.length >= limit) break;
  }
  return out;
}

/* ───────────── jobs ───────────── */

export async function getJob(paperId: string): Promise<Job | null> {
  if (storageBackend === "redis") return rGet<Job>(`job:${paperId}`);
  const row = sql().prepare(`SELECT data FROM jobs WHERE paper_id = ?`).get(paperId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Job) : null;
}

export async function saveJob(job: Job) {
  const data = { ...job, updatedAt: now() };
  if (storageBackend === "redis") {
    await rSet(`job:${job.paperId}`, data);
    return;
  }
  sql().prepare(`INSERT INTO jobs (paper_id, data) VALUES (?, ?) ON CONFLICT(paper_id) DO UPDATE SET data = excluded.data`).run(job.paperId, JSON.stringify(data));
}
