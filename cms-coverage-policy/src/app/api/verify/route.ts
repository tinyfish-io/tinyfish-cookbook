import { db } from "@/lib/db";
import { TinyFish, BrowserProfile, RunStatus } from "@tiny-fish/sdk";
import { STATE_NAMES } from "@/lib/states";

export const runtime = "nodejs";
export const maxDuration = 300;

// "Check again now": a live agent re-reads the official tracker/policy page for
// one state and refreshes the record's verification timestamp (and status, if
// the page disagrees with what we have).
export async function POST(request: Request) {
  if (!process.env.TINYFISH_API_KEY) return Response.json({ error: "TINYFISH_API_KEY not set" }, { status: 500 });

  let body: { state?: string; condition?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be {state, condition}" }, { status: 400 });
  }
  const state = (body.state ?? "").toUpperCase();
  const conditionSlug = body.condition ?? "glp1_obesity";
  const stateName = STATE_NAMES[state];
  if (!stateName) return Response.json({ error: `unknown state ${state}` }, { status: 400 });

  const sql = db();
  const [record] = await sql`
    select r.id, r.coverage_status, r.source_url, c.name as condition_name, c.id as condition_id
    from coverage_records r join conditions c on c.id = r.condition_id
    where c.slug = ${conditionSlug} and r.state = ${state}`;
  if (!record) return Response.json({ error: "no record for that state/condition" }, { status: 404 });

  const [run] = await sql`
    insert into scan_runs (condition_id, state, kind) values (${record.condition_id}, ${state}, 'verify_now') returning id`;
  const started = Date.now();

  try {
    const client = new TinyFish({ timeout: 240_000 });
    const stream = await client.agent.stream({
      url: record.source_url,
      goal: `Find what this page says about ${stateName}'s Medicaid coverage of ${record.condition_name}. Return STRICT JSON: {"status":"covered|limits|prior|not|none","note":"one line quoting or closely paraphrasing what the page says about ${stateName}","found":true|false}. status meanings: covered=no notable restrictions, limits=covered with restrictions, prior=prior authorization is the gate, not=explicitly not covered, none=page says nothing about ${stateName} (then found=false). Never guess.`,
      browser_profile: BrowserProfile.STEALTH,
      proxy_config: { enabled: true, country_code: "US" },
    });

    type VerifyOutcome = { status?: string; note?: string; found?: boolean };
    let outcome: VerifyOutcome | null = null;
    for await (const event of stream) {
      if (event.type === "COMPLETE") {
        const raw = event.status === RunStatus.COMPLETED || event.result ? event.result : null;
        const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
        outcome = ((parsed?.result ?? parsed) as VerifyOutcome | null) ?? null;
        break;
      }
    }

    const durationMs = Date.now() - started;
    if (!outcome?.found || !outcome.status) {
      await sql`update scan_runs set status = 'complete', completed_at = now(), duration_ms = ${durationMs},
        result_note = 'source page no longer addresses this state', changed = false where id = ${run.id}`;
      await sql`update coverage_records set last_checked_at = now() where id = ${record.id}`;
      return Response.json({ ok: true, changed: false, status: record.coverage_status, note: "The source no longer addresses this state — record kept, timestamp refreshed." });
    }

    const changed = outcome.status !== record.coverage_status;
    await sql`
      update coverage_records set last_checked_at = now(),
        coverage_status = ${outcome.status}, criteria_summary = ${outcome.note ?? null}
      where id = ${record.id}`;
    await sql`update scan_runs set status = 'complete', completed_at = now(), duration_ms = ${durationMs},
      result_note = ${outcome.note ?? null}, changed = ${changed} where id = ${run.id}`;
    console.log(`verify: ${state}/${conditionSlug} re-read in ${durationMs}ms — ${changed ? `status changed to ${outcome.status}` : "unchanged"}`);
    return Response.json({ ok: true, changed, status: outcome.status, note: outcome.note ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`update scan_runs set status = 'failed', completed_at = now(), duration_ms = ${Date.now() - started}, error = ${message} where id = ${run.id}`;
    console.log(`verify: ${state}/${conditionSlug} failed because ${message}`);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
