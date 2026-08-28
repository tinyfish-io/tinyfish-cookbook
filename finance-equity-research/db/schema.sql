-- Upstream schema. Applied idempotently by scripts/apply-schema.mjs.
-- Raw Postgres (Supabase session pooler). No supabase-js anywhere.

create table if not exists companies (
  id            bigint generated always as identity primary key,
  ticker        text not null unique,
  name          text not null,
  exchange      text,
  sector        text,
  -- resolved source profile: subreddits, trustpilot domain, app ids, ats board,
  -- edgar cik, newsroom url, downdetector slug… discovered via TinyFish search
  source_profile jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists scans (
  id              bigint generated always as identity primary key,
  company_id      bigint not null references companies(id),
  status          text not null default 'running',           -- running | complete | failed
  direction_score numeric,                                   -- 0-100, null until enough families land
  family_scores   jsonb not null default '{}'::jsonb,        -- {sentiment:{score,weight,baseline}, …}
  provisional     boolean not null default true,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error           text
);
create index if not exists scans_company_started_idx on scans (company_id, started_at desc);

-- one row per TinyFish source run inside a scan
create table if not exists source_runs (
  id            bigint generated always as identity primary key,
  scan_id       bigint not null references scans(id),
  source_key    text not null,               -- reddit | trustpilot | app_store | google_play | careers | layoffs | edgar | newsroom | downdetector
  primitive     text not null,               -- search | fetch | agent
  status        text not null default 'queued',  -- queued | running | complete | failed
  tinyfish_run_id text,
  streaming_url text,
  started_at    timestamptz,
  completed_at  timestamptz,
  duration_ms   integer,
  items_read    integer,
  result        jsonb,
  error         text
);
create index if not exists source_runs_scan_idx on source_runs (scan_id);

-- normalized, citable rows: every claim in the UI is one of these
create table if not exists evidence (
  id           bigint generated always as identity primary key,
  company_id   bigint not null references companies(id),
  scan_id      bigint not null references scans(id),
  family       text not null,               -- sentiment | workforce | leadership | ops
  quote        text not null,               -- verbatim excerpt
  source_key   text not null,
  source_label text not null,               -- "r/CrackerBarrel", "Trustpilot · ★1 review"
  source_url   text,
  published_at date,
  scraped_at   timestamptz not null default now(),
  sentiment    numeric,                     -- -1..1 from the classifier
  extra        jsonb not null default '{}'::jsonb
);
create index if not exists evidence_company_idx on evidence (company_id, scraped_at desc);
create index if not exists evidence_scan_idx on evidence (scan_id);

-- per-scan headline metrics that power the signal tiles
create table if not exists signal_metrics (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references companies(id),
  scan_id     bigint not null references scans(id),
  metric_key  text not null,                -- complaint_velocity | job_postings | app_rating | exec_events | …
  family      text not null,
  value       numeric,
  unit        text,                         -- "/wk", "open", "★"
  baseline    numeric,
  baseline_label text,                      -- "vs prior week", "vs 90-day average", "was 3.8 on Jan 5"
  delta_pct   numeric,
  series      jsonb not null default '[]'::jsonb,  -- sparkline points [{t,v}]
  sources     text,                         -- "Reddit · Trustpilot · X"
  scraped_at  timestamptz not null default now()
);
create index if not exists signal_metrics_scan_idx on signal_metrics (scan_id);
create index if not exists signal_metrics_history_idx on signal_metrics (company_id, metric_key, scraped_at desc);

-- lagging official record: filings, press releases — the timeline's bottom track
create table if not exists official_events (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references companies(id),
  event_type  text not null,               -- 8k_502 | press_release | earnings | other_filing
  title       text not null,
  occurred_on date not null,
  url         text,
  source      text not null default 'sec_edgar',
  is_key      boolean not null default false,   -- highlighted (rust) on the timeline
  created_at  timestamptz not null default now(),
  unique (company_id, event_type, occurred_on, title)
);

-- measured lead-time reads: the product's headline claim, stored not derived-on-the-fly
create table if not exists lead_time_reads (
  id               bigint generated always as identity primary key,
  company_id       bigint not null references companies(id),
  signal_metric    text not null,           -- which series turned (complaint_velocity)
  signal_start_on  date not null,           -- first sustained turn
  signal_rule      text not null,           -- "+22% above trailing 4-week avg, 3 consecutive weeks"
  event_id         bigint references official_events(id),
  filed_on         date not null,
  lead_days        integer not null,
  narrative        text,                    -- "Customers turned 84 days before the filing."
  series           jsonb not null default '[]'::jsonb,  -- indexed weekly points for the chart
  created_at       timestamptz not null default now()
);
