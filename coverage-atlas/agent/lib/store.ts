// Snapshot store. Plain JSON on disk, one immutable file per scan.
//
// Deltas are the product, so history has to be first-class rather than a
// mutable "current" row that overwrites what it replaces. Every scan appends a
// file; the differ reads two. It is also the cheapest possible way to ship a
// demo that opens with complete data — the seed scan is committed.
//
// Two directories, because serverless hosts ship the repository read-only and
// give you exactly one writable path:
//
//   BUNDLED   the committed data/ directory. Always readable, and on Vercel
//             always read-only. This is what makes a fresh deployment open with
//             a full fifty-one-state atlas and a populated change feed.
//   WRITABLE  where new scans land. The same directory locally; /tmp on a
//             serverless host, where it survives for the life of the instance
//             and no longer.
//
// Reads check the writable overlay first and fall back to the bundle, so a scan
// run against a deployment is visible immediately and simply ages out. That is
// the honest behaviour for a demo: better than refusing to scan, and better
// than pretending the result was persisted.

import { mkdir, readFile, readdir, writeFile, appendFile } from "node:fs/promises"
import path from "node:path"
import type { ChangeEvent, ConditionSpec, CoverageRecord, RunLedger, Snapshot } from "./types"

export const DATA_DIR = path.join(process.cwd(), "data")

/** Serverless filesystems are read-only apart from /tmp. */
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

export const WRITABLE_DIR =
  process.env.COVERAGE_ATLAS_DATA_DIR ?? (isServerless ? "/tmp/coverage-atlas-data" : DATA_DIR)

/** True when writes land somewhere that does not survive the instance. */
export const writesAreEphemeral = WRITABLE_DIR !== DATA_DIR

const CONDITIONS = "conditions.json"
const RUNS = "runs.jsonl"
const snapshotRel = (slug: string) => path.join("snapshots", slug)
const changesRel = (slug: string) => path.join("changes", `${slug}.json`)

/** Overlay first, bundle second. */
async function readJson<T>(rel: string, fallback: T): Promise<T> {
  for (const base of writesAreEphemeral ? [WRITABLE_DIR, DATA_DIR] : [DATA_DIR]) {
    try {
      return JSON.parse(await readFile(path.join(base, rel), "utf8")) as T
    } catch {
      /* try the next layer */
    }
  }
  return fallback
}

async function writeJson(rel: string, value: unknown): Promise<void> {
  const file = path.join(WRITABLE_DIR, rel)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8")
}

/** Union of both layers, deduplicated. */
async function listDir(rel: string): Promise<string[]> {
  const seen = new Set<string>()
  for (const base of writesAreEphemeral ? [DATA_DIR, WRITABLE_DIR] : [DATA_DIR]) {
    try {
      for (const entry of await readdir(path.join(base, rel))) seen.add(entry)
    } catch {
      /* layer may not exist yet */
    }
  }
  return [...seen]
}

export async function listConditions(): Promise<ConditionSpec[]> {
  const bundled = await readJsonFrom<ConditionSpec[]>(DATA_DIR, CONDITIONS, [])
  const overlay = writesAreEphemeral ? await readJsonFrom<ConditionSpec[]>(WRITABLE_DIR, CONDITIONS, []) : []
  const byslug = new Map(bundled.map((c) => [c.slug, c]))
  for (const c of overlay) byslug.set(c.slug, c)
  return [...byslug.values()].sort(
    (a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name),
  )
}

async function readJsonFrom<T>(base: string, rel: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(base, rel), "utf8")) as T
  } catch {
    return fallback
  }
}

export async function getCondition(slug: string): Promise<ConditionSpec | null> {
  return (await listConditions()).find((c) => c.slug === slug) ?? null
}

/** Saving is idempotent: rescanning a condition updates its spec, never duplicates it. */
export async function saveCondition(spec: ConditionSpec): Promise<ConditionSpec> {
  const all = await listConditions()
  const at = all.findIndex((c) => c.slug === spec.slug)
  if (at >= 0) all[at] = { ...all[at], ...spec, createdAt: all[at].createdAt }
  else all.push(spec)
  await writeJson(CONDITIONS, all)
  return spec
}

/** Built-in conditions are the demo's floor and cannot be removed. */
export async function deleteCondition(slug: string): Promise<boolean> {
  const all = await listConditions()
  const target = all.find((c) => c.slug === slug)
  if (!target || target.builtIn) return false
  await writeJson(CONDITIONS, all.filter((c) => c.slug !== slug))
  return true
}

/** File-name form of an instant: `2026-08-23T18:45:12.345Z` -> `2026-08-23T18-45-12-345Z`. */
export function toStamp(iso: string): string {
  return iso.replace(/[:.]/g, "-")
}

/** Snapshot file names are ISO timestamps, so lexical order is chronological order. */
export async function listSnapshotStamps(slug: string): Promise<string[]> {
  const files = await listDir(snapshotRel(slug))
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort()
}

export async function readSnapshot(slug: string, stamp?: string): Promise<Snapshot | null> {
  const stamps = await listSnapshotStamps(slug)
  if (stamps.length === 0) return null
  const pick = stamp && stamps.includes(stamp) ? stamp : stamps[stamps.length - 1]
  return readJson<Snapshot | null>(path.join(snapshotRel(slug), `${pick}.json`), null)
}

/**
 * The newest snapshot at or before `at` — how the "view date" control time-travels.
 *
 * `at` may be a stamp, a full ISO instant, or a bare `YYYY-MM-DD`. All three are
 * normalised into stamp space before comparing, because stamps and ISO strings
 * do not sort against each other: `-` sorts below `:`, so a raw lexical compare
 * of the two forms silently mis-orders snapshots taken on the same day.
 */
export async function readSnapshotAsOf(slug: string, at: string): Promise<Snapshot | null> {
  const stamps = await listSnapshotStamps(slug)
  if (stamps.length === 0) return null
  const cutoff = toStamp(at)
  const eligible = stamps.filter((s) => s <= cutoff)
  // Asking for a date before the first scan yields the earliest we have, so the
  // view degrades to "the oldest thing we know" rather than to an empty map.
  return readSnapshot(slug, eligible[eligible.length - 1] ?? stamps[0])
}

export async function writeSnapshot(snapshot: Snapshot): Promise<string> {
  const stamp = toStamp(snapshot.scannedAt)
  await writeJson(path.join(snapshotRel(snapshot.conditionSlug), `${stamp}.json`), snapshot)
  return stamp
}

/**
 * Patch one record inside the newest snapshot, in place.
 *
 * Used only by "check again now". Snapshots are otherwise immutable, but a
 * live re-verification is an observation of the *current* state of the world,
 * so it belongs in the current snapshot rather than opening a new one — a
 * fifty-first snapshot containing one refreshed state would corrupt the differ.
 */
export async function patchLatestRecord(slug: string, record: CoverageRecord): Promise<Snapshot | null> {
  const stamps = await listSnapshotStamps(slug)
  if (stamps.length === 0) return null
  const stamp = stamps[stamps.length - 1]
  const rel = path.join(snapshotRel(slug), `${stamp}.json`)
  const snapshot = await readJson<Snapshot | null>(rel, null)
  if (!snapshot) return null
  snapshot.records = snapshot.records.map((r) => (r.state === record.state ? record : r))
  await writeJson(rel, snapshot)
  return snapshot
}

export async function readChanges(slug: string): Promise<ChangeEvent[]> {
  return readJson<ChangeEvent[]>(changesRel(slug), [])
}

/**
 * Merge new events into the feed, keyed on state+direction+date so a rescan that
 * re-reads the same public announcement does not produce a duplicate alert.
 */
export async function mergeChanges(slug: string, incoming: ChangeEvent[]): Promise<ChangeEvent[]> {
  const existing = await readChanges(slug)
  const byKey = new Map(existing.map((e) => [e.id, e]))
  for (const event of incoming) byKey.set(event.id, { ...byKey.get(event.id), ...event })
  const merged = [...byKey.values()].sort((a, b) =>
    (b.announcedOn ?? b.detectedAt).localeCompare(a.announcedOn ?? a.detectedAt),
  )
  await writeJson(changesRel(slug), merged)
  return merged
}

export async function appendRun(ledger: RunLedger): Promise<void> {
  await mkdir(WRITABLE_DIR, { recursive: true })
  await appendFile(path.join(WRITABLE_DIR, RUNS), JSON.stringify(ledger) + "\n", "utf8")
}

export async function readRuns(limit = 40): Promise<RunLedger[]> {
  const lines: string[] = []
  for (const base of writesAreEphemeral ? [DATA_DIR, WRITABLE_DIR] : [DATA_DIR]) {
    try {
      lines.push(...(await readFile(path.join(base, RUNS), "utf8")).trim().split("\n").filter(Boolean))
    } catch {
      /* layer may not exist yet */
    }
  }
  return lines.slice(-limit).map((l) => JSON.parse(l) as RunLedger).reverse()
}
