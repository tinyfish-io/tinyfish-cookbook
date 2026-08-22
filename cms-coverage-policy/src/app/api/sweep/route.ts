import { db } from "@/lib/db";
import { TinyFish } from "@tiny-fish/sdk";
import { STATE_TILES, STATE_NAMES } from "@/lib/states";
import { TRACKERS } from "@/lib/trackers";

export const runtime = "nodejs";
export const maxDuration = 800;

// Full 51-state sweep, streamed: one tracker fetch + one normalization sets the
// ground truth, then a live TinyFish search per state corroborates with recent
// news. Every state lands as its own SSE event so the map repaints tile by tile.

type SweepEvent =
  | { type: "sweep_started"; states: number; condition: string }
  | { type: "tracker_read"; addressed: number; source: string }
  | { type: "state_checked"; state: string; status: string; changed: boolean; dropped: boolean; news: string | null; idx: number; total: number }
  | { type: "sweep_complete"; checked: number; changed: number; durationMs: number }
  | { type: "sweep_error"; message: string };

export async function POST(request: Request) {
  if (!process.env.TINYFISH_API_KEY) return Response.json({ error: "TINYFISH_API_KEY not set" }, { status: 500 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  let conditionSlug = "glp1_obesity";
  try {
    const body = (await request.json()) as { condition?: string };
    if (body.condition) conditionSlug = body.condition;
  } catch {
    /* default */
  }
  const tracker = TRACKERS[conditionSlug];
  if (!tracker) return Response.json({ error: `unknown condition ${conditionSlug}` }, { status: 400 });

  const sql = db();
  const tinyfish = new TinyFish({ timeout: 300_000 });
  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: SweepEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
          console.log("sweep: viewer disconnected — continuing headless");
        }
      };
      try {
        controller.enqueue(encoder.encode(": ping\n\n"));
      } catch {
        closed = true;
      }

      try {
        const [condition] = await sql`select id, name from conditions where slug = ${conditionSlug}`;
        const existing = await sql`
          select state, coverage_status, dropped_this_year from coverage_records where condition_id = ${condition.id}`;
        const current = new Map(existing.map((r) => [r.state, r]));
        const states = STATE_TILES.map(([code]) => code);
        send({ type: "sweep_started", states: states.length, condition: condition.name });
        await sql`insert into scan_runs (condition_id, kind) values (${condition.id}, 'sweep')`;
        console.log(`sweep: started for ${conditionSlug} across ${states.length} states`);

        // 1. ground truth: one tracker read, one normalization
        const fetched = await tinyfish.fetch.getContents({ urls: [tracker.url], format: "markdown" });
        const first = fetched.results?.[0];
        const candidate = first && "text" in first ? first.text : "";
        const rawText = typeof candidate === "string" ? candidate : "";
        if (rawText.trim().length < 500) {
          throw new Error(fetched.errors?.[0]?.error ?? "tracker fetch returned too little content");
        }
        const currentMap = Object.fromEntries(existing.map((r) => [r.state, r.coverage_status]));
        const normalized = await normalizeTracker(tracker.prompt, rawText, currentMap);
        send({ type: "tracker_read", addressed: normalized.length, source: tracker.doc });
        const bySt = new Map(normalized.map((s) => [s.state, s]));

        // 2. per-state: live search corroboration, waves of 10
        let changed = 0;
        let idx = 0;
        for (let i = 0; i < states.length; i += 10) {
          const wave = states.slice(i, i + 10);
          await Promise.allSettled(
            wave.map(async (state) => {
              const hit = bySt.get(state);
              const newStatus = hit?.status ?? current.get(state)?.coverage_status ?? "none";
              const wasStatus = current.get(state)?.coverage_status;
              const didChange = wasStatus != null && wasStatus !== newStatus;
              if (didChange) changed++;

              let news: string | null = null;
              try {
                const found = await tinyfish.search.query({
                  query: `${STATE_NAMES[state]} Medicaid ${tracker.name} coverage policy change`,
                  location: "US",
                  language: "en",
                });
                const fresh = found.results.find(
                  (r) => (r.title + " " + (r.snippet ?? "")).toLowerCase().includes("medicaid") && /202[56]/.test(r.title + " " + (r.snippet ?? "")),
                );
                if (fresh) news = fresh.title;
              } catch {
                /* corroboration is best-effort; the tracker read stands */
              }

              await sql`
                update coverage_records set coverage_status = ${newStatus},
                  dropped_this_year = ${hit?.dropped_this_year ?? current.get(state)?.dropped_this_year ?? false},
                  criteria_summary = coalesce(${hit?.note ?? null}, criteria_summary),
                  last_checked_at = now()
                where condition_id = ${condition.id} and state = ${state}`;

              idx++;
              send({
                type: "state_checked",
                state,
                status: newStatus,
                changed: didChange,
                dropped: hit?.dropped_this_year ?? false,
                news,
                idx,
                total: states.length,
              });
            }),
          );
        }

        const durationMs = Date.now() - started;
        await sql`update scan_runs set status = 'complete', completed_at = now(), duration_ms = ${durationMs},
          result_note = ${`${states.length} states checked, ${changed} changed`}
          where condition_id = ${condition.id} and kind = 'sweep' and completed_at is null`;
        console.log(`sweep: ${conditionSlug} complete in ${durationMs}ms — ${changed} status changes`);
        send({ type: "sweep_complete", checked: states.length, changed, durationMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`sweep: failed because ${message}`);
        send({ type: "sweep_error", message });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function normalizeTracker(context: string, rawText: string, currentMap: Record<string, string>) {
  const clipped = rawText.length > 90_000 ? rawText.slice(0, 90_000) : rawText;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${context} From the page content, extract per-state coverage. STRICT JSON:
{"states":[{"state":"2-letter code","status":"covered|limits|prior|not|none","note":"one plain-language line from the page about this state, or null","dropped_this_year":boolean}]}
NEVER guess: only include states the page actually addresses.
Our currently recorded statuses (from the last verified sweep of this same page): ${JSON.stringify(currentMap)}
Stability rule: keep a state's current status UNLESS the page clearly and specifically contradicts it. Borderline judgment calls (covered vs limits, prior vs limits) resolve to the CURRENT status. A change you report is treated as a policy-change alert, so report one only when the page's text plainly supports it.`,
        },
        { role: "user", content: clipped },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  return (JSON.parse(data.choices[0].message.content).states ?? []) as {
    state: string;
    status: string;
    note: string | null;
    dropped_this_year: boolean;
  }[];
}
