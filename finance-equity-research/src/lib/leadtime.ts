import { db } from "./db";
import type { SourceProfile } from "./sources";

// Measured lead time for any company, honestly: reconstruct a historical
// complaint/review-velocity series from Wayback Machine snapshots of the
// company's Trustpilot page (review totals over the past year are archived
// facts), detect a sustained turn, and pair it with a real officer-change
// 8-K already ingested from EDGAR. No history is invented: if the archive
// or the filing isn't there, we say so.

const TURN_RULE = "+22% above trailing 4-sample average, sustained for three consecutive samples";

export type LeadTimeResult =
  | { ok: true; leadDays: number; signalStart: string; filedOn: string; samples: number }
  | { ok: false; reason: string };

export async function computeLeadTime(ticker: string): Promise<LeadTimeResult> {
  const sql = db();
  const [company] = await sql`select id, name, source_profile from companies where ticker = ${ticker.toUpperCase()}`;
  if (!company) return { ok: false, reason: `Unknown company ${ticker}.` };
  const profile = company.source_profile as SourceProfile;
  if (!profile.trustpilotDomain) {
    return { ok: false, reason: "No Trustpilot presence in this company's source profile — no archived review history to measure." };
  }

  // 1. real historical series from the Internet Archive
  const page = `https://www.trustpilot.com/review/${profile.trustpilotDomain}`;
  const snapshots = await waybackSnapshots(page);
  if (snapshots.length < 8) {
    return { ok: false, reason: `Only ${snapshots.length} archived snapshots of the Trustpilot page in the last 15 months — too few to measure a trend (need 8).` };
  }

  const points: { t: string; total: number }[] = [];
  for (const snap of snapshots) {
    const total = await reviewTotalAt(snap.ts, page);
    if (total != null) points.push({ t: snap.date, total });
  }
  console.log(`leadtime ${ticker}: ${snapshots.length} snapshots sampled, ${points.length} readable review totals`);
  if (points.length < 8) {
    return { ok: false, reason: `Could read review totals from only ${points.length} archived snapshots — too few to measure a trend (need 8).` };
  }

  // totals → per-day velocity between snapshots → indexed series (first = 100)
  const velocity: { t: string; v: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const days = Math.max(1, (Date.parse(points[i].t) - Date.parse(points[i - 1].t)) / 86_400_000);
    const perDay = Math.max(0, (points[i].total - points[i - 1].total) / days);
    velocity.push({ t: points[i].t, v: perDay });
  }
  const base = velocity.slice(0, 3).reduce((s, p) => s + p.v, 0) / 3 || 1;
  const series = velocity.map((p) => ({ t: p.t, v: Math.round((p.v / base) * 100) }));

  // 2. sustained-turn detection (same rule as the calibration case)
  let turnAt: string | null = null;
  for (let i = 4; i < series.length - 2; i++) {
    const trailing = (series[i - 4].v + series[i - 3].v + series[i - 2].v + series[i - 1].v) / 4;
    const sustained = [0, 1, 2].every((k) => i + k < series.length && series[i + k].v >= trailing * 1.22);
    if (sustained) {
      turnAt = series[i].t;
      break;
    }
  }
  if (!turnAt) {
    return { ok: false, reason: `No sustained turn found in ${series.length} samples of archived review velocity — this company's complaint signal has been flat. That is a finding, not a failure.` };
  }

  // 3. pair with a real officer-change filing after the turn
  const [event] = await sql`
    select id, occurred_on from official_events
    where company_id = ${company.id} and event_type = '8k_502' and occurred_on > ${turnAt}::date
    order by occurred_on asc limit 1`;
  if (!event) {
    return { ok: false, reason: `Signal turned on ${turnAt}, but no officer-change 8-K has been filed after it (run a scan first so EDGAR filings are ingested — or the filing simply hasn't happened yet).` };
  }

  const leadDays = Math.round((Date.parse(String(event.occurred_on)) - Date.parse(turnAt)) / 86_400_000);
  if (leadDays < 14) return { ok: false, reason: `Turn and filing are only ${leadDays} days apart — too close to claim a lead.` };

  await sql`delete from lead_time_reads where company_id = ${company.id} and signal_metric = 'trustpilot review velocity'`;
  await sql`
    insert into lead_time_reads (company_id, signal_metric, signal_start_on, signal_rule, event_id, filed_on, lead_days, narrative, series)
    values (${company.id}, 'trustpilot review velocity', ${turnAt}, ${TURN_RULE}, ${event.id}, ${event.occurred_on}, ${leadDays},
      ${`Customers turned ${leadDays} days before the filing.`}, ${sql.json(series)})`;
  console.log(`leadtime ${ticker}: measured ${leadDays}d lead (turn ${turnAt} → filing ${event.occurred_on}) from ${series.length} archived samples`);
  return { ok: true, leadDays, signalStart: turnAt, filedOn: String(event.occurred_on), samples: series.length };
}

async function waybackSnapshots(url: string): Promise<{ ts: string; date: string }[]> {
  const from = new Date(Date.now() - 456 * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&from=${from}&output=json&filter=statuscode:200&collapse=timestamp:8`;
  // archive.org rate-limits hard; retry with backoff before giving an honest answer
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(cdx, { headers: { "User-Agent": "Upstream research demo contact@tinyfish.ai" } });
    if (response.status !== 429 && response.status !== 503) break;
    console.log(`leadtime: Wayback CDX ${response.status}, backing off (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
  }
  if (!response?.ok) {
    throw new Error(
      response?.status === 429
        ? "The Internet Archive is rate-limiting right now — try again in a few minutes; the measurement will work when it cooperates."
        : `Wayback CDX returned ${response?.status}`,
    );
  }
  const rows = (await response.json()) as string[][];
  const all = rows.slice(1).map((r) => r[1]); // timestamp column
  // sample roughly weekly: keep first snapshot of each ISO week
  const byWeek = new Map<string, string>();
  for (const ts of all) {
    const date = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
    const week = isoWeek(date);
    if (!byWeek.has(week)) byWeek.set(week, ts);
  }
  return [...byWeek.values()].sort().map((ts) => ({ ts, date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` }));
}

async function reviewTotalAt(ts: string, url: string): Promise<number | null> {
  try {
    const response = await fetch(`https://web.archive.org/web/${ts}id_/${url}`, {
      headers: { "User-Agent": "Upstream research demo contact@tinyfish.ai" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    for (const pattern of [
      /"numberOfReviews"\s*:\s*\{?[^}0-9]*([\d,]+)/,
      /"reviewCount"\s*:\s*"?([\d,]+)/,
      /Based on ([\d,]+) reviews/i,
      /([\d,]+)\s+total\s+reviews/i,
    ]) {
      const match = html.match(pattern);
      if (match) {
        const n = Number(match[1].replaceAll(",", ""));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isoWeek(date: string): string {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}
