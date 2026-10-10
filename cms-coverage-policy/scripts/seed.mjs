// Coverage Atlas seed. The state-by-state statuses are SCRAPED live from the
// authoritative public trackers (TinyFish fetch → LLM normalize), not typed in —
// every record carries the tracker as its source. Change events and the SC/TX
// verbatim criteria come from docs/research (cited).
// Run: bash -c 'set -a; source .env.local; set +a; node scripts/seed.mjs'
import postgres from "postgres";
import { TinyFish } from "@tiny-fish/sdk";

const { DATABASE_URL, TINYFISH_API_KEY, OPENAI_API_KEY } = process.env;
if (!DATABASE_URL || !TINYFISH_API_KEY || !OPENAI_API_KEY) {
  console.error("seed: failed because DATABASE_URL/TINYFISH_API_KEY/OPENAI_API_KEY must all be set");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const tinyfish = new TinyFish({ timeout: 300_000 });

const ALL_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

const TRACKERS = {
  glp1_obesity: {
    name: "GLP-1 weight-loss drugs (obesity)",
    url: "https://therxindex.com/research/medicaid-glp-1-coverage-by-state/",
    doc: "The RX Index — Medicaid GLP-1 coverage by state tracker",
    prompt:
      "This page tracks which US state Medicaid programs cover GLP-1 drugs for the OBESITY/weight-loss indication (the diabetes indication is federally mandated everywhere — ignore it).",
  },
  cgm: {
    name: "Continuous glucose monitors",
    url: "https://t1dexchange.org/a-guide-to-cgms-and-medicaid-coverage-differences-by-state/",
    doc: "T1D Exchange — CGMs and Medicaid coverage differences by state",
    prompt:
      "This page tracks US state Medicaid coverage of continuous glucose monitors (CGM): which states cover via pharmacy/medical benefit, which require prior authorization, which have no published FFS policy.",
  },
};

async function fetchTracker(url) {
  const res = await tinyfish.fetch.getContents({ urls: [url], format: "markdown" });
  const text = res.results?.[0]?.text ?? "";
  if (text.trim().length > 500) return text;
  throw new Error(res.errors?.[0]?.error ?? "tracker fetch returned too little content");
}

async function normalizeStates(context, rawText) {
  const clipped = rawText.length > 90_000 ? rawText.slice(0, 90_000) : rawText;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${context} From the page content, extract per-state coverage. STRICT JSON:
{"states":[{"state":"2-letter code","status":"covered|limits|prior|not|none","note":"one plain-language line from the page about this state, or null","dropped_this_year":boolean}]}
status meanings: covered = covered without notable restrictions; limits = covered with restrictions (BMI thresholds, step therapy, reauthorization); prior = coverage exists but prior authorization is the defining gate; not = explicitly not covered; none = the page says nothing about this state.
NEVER guess: only include states the page actually addresses. dropped_this_year = true only if the page says coverage ended/was dropped in the last ~12 months.`,
        },
        { role: "user", content: clipped },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content).states ?? [];
}

try {
  // conditions
  for (const [slug, t] of Object.entries(TRACKERS)) {
    await sql`insert into conditions (slug, name) values (${slug}, ${t.name}) on conflict (slug) do nothing`;
  }
  const conditionIds = Object.fromEntries(
    (await sql`select id, slug from conditions`).map((c) => [c.slug, c.id]),
  );

  // scraped statuses per condition
  for (const [slug, tracker] of Object.entries(TRACKERS)) {
    let states = [];
    try {
      const raw = await fetchTracker(tracker.url);
      states = await normalizeStates(tracker.prompt, raw);
      console.log(`seed: ${slug} tracker scraped — ${states.length} states addressed`);
    } catch (err) {
      console.error(`seed: ${slug} tracker scrape failed because ${err.message} — states not addressed stay 'none'`);
    }
    const bySt = new Map(states.map((s) => [s.state, s]));
    for (const st of ALL_STATES) {
      const hit = bySt.get(st);
      await sql`
        insert into coverage_records (condition_id, state, coverage_status, criteria_summary, source_doc, source_url, dropped_this_year)
        values (${conditionIds[slug]}, ${st}, ${hit?.status ?? "none"},
          ${hit?.note ?? "Not addressed in the last tracker sweep — a live agent sweep will fill this in."},
          ${tracker.doc}, ${tracker.url}, ${hit?.dropped_this_year ?? false})
        on conflict (condition_id, state, program) do update set
          coverage_status = excluded.coverage_status, criteria_summary = excluded.criteria_summary,
          source_doc = excluded.source_doc, source_url = excluded.source_url,
          dropped_this_year = excluded.dropped_this_year, last_checked_at = now()`;
    }
  }

  // researched 2026 change events (docs/research/cms-data-landscape.md, cited)
  const glp1 = conditionIds.glp1_obesity;
  const changes = [
    ["MA", "Massachusetts ended obesity coverage", "covered", "not", "coverage_dropped", "2026-07-01", "2026-07-01",
      "KFF Medicaid GLP-1 tracker", "https://www.kff.org/medicaid/medicaid-coverage-of-and-spending-on-glp-1s/", null],
    ["UT", "Utah's pilot program expired without renewal", "limits", "not", "coverage_dropped", "2026-06-30", "2026-06-30",
      "The RX Index tracker", "https://therxindex.com/research/medicaid-glp-1-coverage-by-state/", null],
    ["NC", "North Carolina reinstated coverage with new limits", "not", "limits", "coverage_added", "2025-12-01", "2025-12-01",
      "The RX Index tracker", "https://therxindex.com/research/medicaid-glp-1-coverage-by-state/", "Dropped in October, reinstated eight weeks later."],
    ["NC", "North Carolina dropped obesity coverage", "covered", "not", "coverage_dropped", "2025-10-01", "2025-10-01",
      "The RX Index tracker", "https://therxindex.com/research/medicaid-glp-1-coverage-by-state/", null],
    ["CA", "California eliminated the obesity indication", "covered", "not", "coverage_dropped", "2025-11-01", "2026-01-01",
      "KFF Medicaid GLP-1 tracker", "https://www.kff.org/medicaid/medicaid-coverage-of-and-spending-on-glp-1s/", null],
    ["PA", "Pennsylvania eliminated the obesity indication", "covered", "not", "coverage_dropped", "2025-10-15", "2025-11-01",
      "KFF Medicaid GLP-1 tracker", "https://www.kff.org/medicaid/medicaid-coverage-of-and-spending-on-glp-1s/", null],
  ];
  for (const [state, headline, from, to, type, announced, effective, doc, url, note] of changes) {
    await sql`
      insert into change_events (condition_id, state, headline, from_status, to_status, change_type, announced_on, effective_on, source_doc, source_url, note)
      values (${glp1}, ${state}, ${headline}, ${from}, ${to}, ${type}, ${announced}, ${effective}, ${doc}, ${url}, ${note})
      on conflict (condition_id, state, announced_on, change_type) do nothing`;
  }

  // SC vs TX CGM criteria — verbatim quotes from docs/research (CHCS / T1D Exchange)
  const cgm = conditionIds.cgm;
  const rows = [
    ["SC", "hypoglycemia", "Hypoglycemia threshold", "Recurrent moderate lows, or one severe low, despite following the treatment plan.",
      "…recurrent moderate or at least one severe hypoglycemic event despite adherence to the treatment plan.", "SC DHHS DME criteria"],
    ["TX", "hypoglycemia", "Hypoglycemia threshold", "Frequent severe lows, unexplained swings, ketoacidosis, or a hospitalization.",
      "…frequent severe hypoglycemia, unexplained glucose fluctuations, ketoacidosis, or hospitalization related to glycemic control.", "TX HHSC VDP criteria"],
    ["SC", "non_insulin", "Patients not on insulin", "Eligible if they meet the hypoglycemia threshold above.",
      null, "SC DHHS DME criteria"],
    ["TX", "non_insulin", "Patients not on insulin", "Not eligible — an insulin requirement applies.",
      null, "TX HHSC VDP criteria"],
  ];
  for (const [state, criterion, label, plain, verbatim, doc] of rows) {
    await sql`
      insert into criteria_rows (condition_id, state, criterion, label, plain, verbatim, source_doc)
      values (${cgm}, ${state}, ${criterion}, ${label}, ${plain}, ${verbatim}, ${doc})
      on conflict (condition_id, state, criterion) do update set
        plain = excluded.plain, verbatim = excluded.verbatim, source_doc = excluded.source_doc`;
  }

  const counts = await sql`select
    (select count(*) from coverage_records) as records,
    (select count(*) from change_events) as changes,
    (select count(*) from criteria_rows) as criteria`;
  console.log(`seed: ok — ${counts[0].records} coverage records, ${counts[0].changes} change events, ${counts[0].criteria} criteria rows`);
} catch (err) {
  console.error(`seed: failed because ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
