-- Coverage Atlas schema. Applied idempotently by scripts/apply-schema.mjs.
-- Raw Postgres (Supabase session pooler). No supabase-js anywhere.

create table if not exists conditions (
  id         bigint generated always as identity primary key,
  slug       text not null unique,          -- glp1_obesity | cgm
  name       text not null,                 -- "GLP-1 weight-loss drugs (obesity)"
  program    text not null default 'medicaid_ffs',
  created_at timestamptz not null default now()
);

create table if not exists coverage_records (
  id                   bigint generated always as identity primary key,
  condition_id         bigint not null references conditions(id),
  state                text not null,       -- 2-letter USPS + DC
  program              text not null default 'medicaid_ffs',
  coverage_status      text not null,       -- covered | limits | prior | not | none
  criteria_summary     text,                -- plain words
  criteria_raw_excerpt text,                -- VERBATIM from the source document
  administering_entity text,
  source_doc           text,                -- "NC Medicaid Preferred Drug List, p. 41 (PDF)"
  source_url           text,
  effective_date       date,
  dropped_this_year    boolean not null default false,
  last_checked_at      timestamptz not null default now(),
  content_hash         text,
  superseded_by        bigint references coverage_records(id),
  created_at           timestamptz not null default now(),
  unique (condition_id, state, program)
);
create index if not exists coverage_condition_idx on coverage_records (condition_id, state);

create table if not exists change_events (
  id            bigint generated always as identity primary key,
  condition_id  bigint not null references conditions(id),
  state         text not null,
  headline      text not null,              -- plain language: "Massachusetts ended obesity coverage"
  from_status   text not null,
  to_status     text not null,
  change_type   text not null,              -- coverage_added | coverage_dropped | pa_removed | new_pa_requirement | criteria_narrowed | criteria_broadened
  announced_on  date not null,
  effective_on  date,
  source_doc    text,
  source_url    text,
  note          text,                       -- "Prescriptions fell 64% the following quarter."
  last_checked_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (condition_id, state, announced_on, change_type)
);

-- verify-now / sweep runs
create table if not exists scan_runs (
  id            bigint generated always as identity primary key,
  condition_id  bigint references conditions(id),
  state         text,
  kind          text not null,              -- verify_now | sweep
  status        text not null default 'running',
  tinyfish_run_id text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  duration_ms   integer,
  result_note   text,
  changed       boolean,
  error         text
);

-- criteria diff rows for the compare view (per condition, pairwise by state)
create table if not exists criteria_rows (
  id            bigint generated always as identity primary key,
  condition_id  bigint not null references conditions(id),
  state         text not null,
  criterion     text not null,              -- who_qualifies | insulin | prior_auth | recent_visit | logs | age | supplies
  label         text not null,              -- "Who qualifies"
  plain         text not null,              -- plain-words summary
  verbatim      text,                       -- exact policy wording
  source_doc    text,
  effective_date date,
  unique (condition_id, state, criterion)
);
