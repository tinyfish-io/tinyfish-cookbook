/**
 * Phase 5: "new since your last scan". The browser remembers when it first saw each job (by the
 * URL-based job id). A scan marks as new every job it hasn't seen before — except the very first
 * scan, where "everything is new" would say nothing.
 */

/** job id → ISO time it was first seen in this browser. */
export type SeenMap = Record<string, string>;

/** Keep the history bounded so localStorage never fills up. */
export const MAX_SEEN = 1000;

export function markNew(seen: SeenMap, ids: string[], now: string): { newIds: string[]; seen: SeenMap } {
  const firstScan = Object.keys(seen).length === 0;
  const newIds = firstScan ? [] : ids.filter((id) => !(id in seen));
  const next: SeenMap = { ...seen };
  for (const id of ids) next[id] ??= now;

  const entries = Object.entries(next);
  if (entries.length <= MAX_SEEN) return { newIds, seen: next };
  // Drop the oldest first sightings.
  entries.sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));
  return { newIds, seen: Object.fromEntries(entries.slice(0, MAX_SEEN)) };
}

/** Scans older than this get a "time to rescan" nudge. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStale(scannedAt: string, now = Date.now()): boolean {
  return now - new Date(scannedAt).getTime() > STALE_AFTER_MS;
}
