/**
 * Cost guard for the public deploy. Search and Fetch are free, but every scan also calls the LLM,
 * and deep search spends metered TinyFish Agent runs — so a public URL needs limits.
 *
 * - Rate limit: at most MAX_SCANS scans per client per window. In-memory, so it's per server
 *   instance (Fluid Compute reuses instances, so it catches the common case); a Vercel Firewall
 *   rate-limit rule is the belt-and-braces option.
 * - Deep search: in production it needs DEEP_SEARCH_PASSCODE (sent by the client). Locally it's open.
 */
import { timingSafeEqual } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SCANS = 6;
const hits = new Map<string, number[]>();

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
}

/** Records a scan for this client; returns seconds to wait if over the limit. */
export function rateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_SCANS) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return { ok: true };
}

/** Deep search is open in development; in production it needs the passcode. */
export function deepSearchAllowed(passcode: string | undefined | null): boolean {
  const expected = process.env.DEEP_SEARCH_PASSCODE;
  if (!expected) return process.env.NODE_ENV !== "production";
  if (!passcode) return false;
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Test-only: forget recorded scans. */
export function resetRateLimit() {
  hits.clear();
}

export const LIMITS = { WINDOW_MS, MAX_SCANS };
