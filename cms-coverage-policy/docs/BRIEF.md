# Coverage Atlas — CMS Coverage Policy Across 50 States

> Working name: **Coverage Atlas**. Angle brief, 2026-08-21. Grounded in `docs/research/`.

## The one-liner

Pick a condition. See how all 50 states cover it — status, prior-auth criteria verbatim, effective dates — on one map, one matrix, and one change timeline. Then diff two states side by side. Live web agents keep it verified; nobody else shows a "last verified" timestamp because nobody else actually checks.

## Why this doesn't exist (the differentiation, from research)

The market is two disconnected halves: enterprise platforms (Policy Reporter: 4.1M+ tracked changes, MMIT) that are deep but lookup-shaped — no public map, no matrix, no diff; and public trackers (KFF) with great map/table/trend presentation but stale, single-condition data. **No product combines: (a) 50-state choropleth + criteria matrix + change timeline, (b) verbatim PA criteria with source-document citation and effective/verified dates, (c) a genuine state-vs-state policy diff.** We ship all three. The diff view alone exists nowhere.

## The insight is the comparison and the delta

- Same drug, same patient, different state → different answer. GLP-1s for obesity: covered in **11 states**, ~80% of adult Medicaid enrollees have no pathway.
- Rules churn mid-year: CA/NH/PA/SC dropped obesity GLP-1 coverage after Oct 2025; **NC dropped it in October and reinstated it in December**; UT's pilot died June 30; MA ended July 1. A static scrape can't tell that story; a snapshot-diff engine can.
- Structural asymmetry we say out loud in the demo: Medicare publishes a weekly change feed (MCD "What's New", captured Sundays, published Thursdays) — you can *read* the delta. Medicaid has no feed at all — **the delta must be computed**, by snapshotting 50 independent state sources and diffing. That's precisely why this needs live web agents instead of a dataset.

## The four views

1. **Atlas (map)** — 50-state choropleth per condition, colored by coverage status (covered / PA required / limits / not covered / no published policy). KFF-grade legend discipline; map is never the only view — table toggle always present.
2. **Matrix** — 50 states × criteria columns (status, PA?, step therapy?, key threshold e.g. BMI ≥30, quantity limits, effective date). The grid no commercial product ships.
3. **Delta feed** — "what shifted in the last 90 days": timeline of change events (`coverage_dropped`, `pa_removed`, `criteria_narrowed`…), each linking to before/after records. Medicare events read from the MCD What's New feed; Medicaid events computed by our snapshot diffs; historical 2026 churn seeded with citations.
4. **State vs State diff** — two states side by side, **verbatim PA criteria** aligned criterion by criterion. SC's "recurrent moderate or ≥1 severe hypoglycemic event" against TX's "frequent severe hypoglycemia, unexplained fluctuations, ketoacidosis, or hospitalization." Paraphrase blurs clinically load-bearing distinctions; we never paraphrase without the verbatim underneath.

Credibility furniture on every record (AMA-flagged pain point, no competitor shows all of it): effective date, source document link (the actual LCD page / PDL PDF), administering entity (MAC jurisdiction or state agency/PBM), **and separately: "last verified by our scanner" timestamp**.

## Demo conditions (v1 ships two, architecture holds any)

- **GLP-1s for obesity** — the headline: freshest churn, dramatic map, money story ($1,000+/month, state budget-driven).
- **CGMs** — the clean contrast: no federal NCD floor, so criteria scatter; NY (PA dropped entirely) vs NJ (no published FFS policy) is the perfect diff pair; DME MAC jurisdiction map ≠ A/B map is the wonky detail that makes providers nod.
- Next up (post-v1): gene therapy (federal coordination narrows variation — the counter-example), ABA therapy, Hep-C DAAs (multi-year trendline).

## The live-agent story (honest architecture)

Scanning 50 states live on stage is neither possible nor the point. The correct architecture — and the demo narrative — is:
- **Continuous scan layer:** TinyFish agents (stealth profile — cms.gov and state sites 403 plain fetchers, live-verified) walk the MCD reports, LCD pages, and state PDL documents on a schedule; every result normalized by LLM (GPT-5) into `CoverageRecord`s with `content_hash` delta detection.
- **On-stage live beat:** "verify a state now" button — one agent runs live against a state's PDL page / MCD report, streaming browser visible, record's `last_verified` ticks to *just now*. Concrete, watchable, and it's the actual mechanism that keeps the atlas alive.
- **SDUD cross-check:** data.medicaid.gov utilization API (real JSON, zero scraping) corroborates deltas — utilization cratering after a coverage drop, shown as a small chart on change events. No competitor connects policy deltas to utilization.

## Data model

`coverage_records` per the research schema (condition, treatment_code, state, program, administering_entity, mac_jurisdiction, coverage_status, criteria_summary, **criteria_raw_excerpt verbatim**, source_doc_id/type/url, effective_date, last_checked_at, content_hash, superseded_by, change_type) + `scan_runs` (per-source agent run log) + `change_events` (materialized delta feed) + static `mac_jurisdictions` table (A/B and DME maps separately; CA/NY sub-jurisdiction special cases). Medicare: one LCD expands to state rows via the MAC table without re-scraping. Medicaid: each state its own scrape target with a state→hosting-domain lookup (NY lives on the PBM's domain, not .gov).

## Architecture

- Next.js (App Router, TS, Tailwind + shadcn), Vercel. Same stack as the finance demo.
- TinyFish `@tiny-fish/sdk`; agent (stealth) for cms.gov/state sites, fetch for PDFs/SDUD; waves of 5; queue+poll for the bulk scan layer, SSE stream for the on-stage verify button.
- **Raw Postgres** (`postgres` driver, Supabase session pooler `DATABASE_URL`) — no supabase-js.
- LLM normalization: GPT-5 for criteria extraction into structured records; Fireworks open-source for bulk PDF text labeling where quality holds.
- Logging: every scan run logs state, source, duration, records extracted, hash-change count, and specific failure reasons.

## v1 cut (Friday EOD)

- Two conditions (GLP-1 obesity, CGM) × 50 states × Medicaid FFS + Medicare where applicable, seeded from a first bulk scan + curated authoritative trackers (each record still carrying its real source URL); live-verify button working on stage for HTML-tier states and MCD.
- All four views working; delta feed seeded with the documented 2026 churn (cited) + any deltas our own snapshots catch between now and Friday.
- Not in v1: all-condition search, alerts, MCO-level (FFS only), fee schedules/pricing.
