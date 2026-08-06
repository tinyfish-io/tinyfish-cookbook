# TinyFish Setup + Skills — Design

Date: 2026-08-05
Status: approved (London), eng-reviewed + CEO-reviewed, internal test phase
Branch: `tinyfish-setup-skills` (coworker test; not GA; repo/branch is a
temporary home — content is markdown + one CLI PR, moving later is cheap)
Owner: London Davila (through internal phase; GA owner decided at GA gate)

## Problem

PostHog funnel data shows a large intent-but-fail population: users reach the
onboarding copy-paste step and never succeed, either failing to paste/run the
terminal command (~40% terminal success vs ~98% in-page run) or failing after
attempting MCP setup. Separately, users who touch the API activate at 47–64%
vs 9–15% for agent-only users — deeper surface contact predicts retention.
Correlation, not proven causation — so installer success and activation are
measured separately (see Telemetry).

Two jobs, one system:

1. **Rescue the droppers** — replace the fragile multi-step copy-paste with a
   single command that automates everything after the first paste.
2. **Deepen the survivors** — skills inside their coding harness that drive
   API/SDK contact.

Prior art proving feasibility: gstack (persistent checkout + throttled
version check + adapter regeneration) and caveman (multi-harness installer,
idempotent, clean `--uninstall`, agent-prompt repair path). Claude Code's
native plugin marketplace provides harness-managed auto-update for free.

## What already exists (build on, never rebuild)

- **`tinyfish connect <client>`** (`ux-labs/sdk/cli`) — already ships:
  one-command MCP OAuth for claude-code and codex (zero key paste),
  `use-tinyfish` skill install from this repo via the `skills` CLI package,
  telemetry with attempt IDs to `/api/cli/connect-event`. Hermes and OpenClaw
  clients exist but are **interactive walkthrough flows** (seeded `hermes
  chat`; `openclaw chat` onboarding — OpenClaw is excluded from the
  native-MCP connect path). This IS the installer core; v1 extends it.
- **`tinyfish auth login`** — browser-open + hidden key paste + format
  validation; non-interactive stdin path for CI. Covers harnesses without
  MCP OAuth (Cursor).
- **Claude Code plugin marketplace** — `.claude-plugin/marketplace.json` →
  `plugins/tinyfish` (MCP config + agent/fetch/search skills). Harness-native
  auto-update ("plugins updated, reload").
- **Frontend first-usage polling** (`useSetupUsage`) — onboarding polls
  first-usage signals; reusable later for zero-paste UX, not an auth endpoint.

## Shape (v1, internal test)

Harness scope: **Claude Code, Codex, Cursor, Hermes, OpenClaw** (E1).
Cursor is the only new client implementation; Hermes/OpenClaw are scoped to
**non-interactive configure + verify only** in `--all` (their existing
interactive walkthroughs remain the single-client `connect <client>`
behavior — `--all` never spawns an interactive session). Effort for the
Hermes/OpenClaw non-interactive path is M, not S: it is new flow code.
Others (Windsurf, Cline, Copilot, Gemini CLI) wait for GA evidence.

Two honest install paths (not "one universal installer"):

- **Claude Code** — plugin marketplace: `/plugin marketplace add
  tinyfish-io/tinyfish-cookbook` + install. MCP OAuth on first use.
- **Other harnesses** — `npx @tiny-fish/cli connect --all` (new flag; bare
  `connect <client>` keeps current single-client behavior): detects present
  harnesses, installs per harness, per-harness failure isolation, end
  summary. Agent-prompt fallback/repair: `INSTALL.md` committed at repo
  root, written for agent consumption ("read INSTALL.md, install TinyFish
  for me"); agent-oriented repair material, exempt from the E5 public-docs
  deferral; hand-maintained by the spec owner (accepted explicitly — not
  generator-emitted in v1).

### Per-harness capability matrix (authoritative for steps 1–5)

| Harness | Config write mechanism | Auth | Verify depth | Skills |
|---|---|---|---|---|
| Claude Code | marketplace (harness-managed; recommended path). In `--all`: falls back to the existing `connect claude-code` OAuth path (harness-owned writes) and prints the marketplace pointer in the summary; telemetry records `installed` from that path like any other harness | MCP OAuth (harness-stored) | health-only | plugin skills (invocable) |
| Codex | `codex mcp add` (harness-owned write — no TOML touched by us) | MCP OAuth (harness-stored) | health-only | skill files (invocable) |
| Cursor | direct JSON write by CLI: parse + merge + timestamped backup + restore-on-parse-failure | API key via `auth login` (CLI config store) | health + authenticated check | rules file (passive context — no invocation; doctor/feedback NOT shipped as Cursor "skills", see Skills) |
| Hermes | `hermes mcp add` (harness-owned write) | MCP OAuth (harness-stored) | health-only | skill files (invocable) |
| OpenClaw | skill install delegated to the pinned `skills` package (`skills install --global`) — delegated write, not CLI-written | existing `tinyfish auth login --source openclaw` path (key in CLI config store) | health + authenticated check (CLI holds the key) | workspace skills (invocable) |

Backup/merge/restore rigor applies to **files the CLI itself writes**
(Cursor JSON, any rules files). Delegated writes (`codex mcp add`,
`hermes mcp add`, marketplace, the `skills` package) — we cannot and do
not promise backup of files we never touch.

**Non-interactive (definition):** `--all` never spawns an agent chat
session (the Hermes/OpenClaw walkthroughs). Auth prompts are allowed:
OAuth harnesses run sequentially, each gated on a "press enter to open
browser" prompt so a full run is at most a few sequential browser hops.
With no TTY, harnesses lacking stored auth are skipped with a pointer
(never prompt, never fail the run).

Credential storage: the CLI stores only the Cursor/API-key credential
(existing config store, 0600, never echoed, never logged; overwrite only
with `--force`). OAuth tokens are harness-managed; `--force` does not apply
to them. Raw credentials never ride telemetry or reports — SHA-256 lookup
key only.

### `connect --all` flow

1. **Detect** the five harness config dirs; absent ones skipped silently.
2. **Auth** — per capability matrix. Non-interactive: `TINYFISH_API_KEY` env.
3. **Configure** — per capability matrix. Idempotent re-runs; `--uninstall`
   removes our entries and leaves user content intact.
4. **Verify (honest, per-harness depth)** — health check against the MCP
   endpoint for all; authenticated check where the CLI holds the key
   (Cursor, OpenClaw). Summary prints per-harness ✓/✗ **with depth label**
   (`verified: health` vs `verified: health+auth`) + reason + fix hint.
   In-harness E2E is out of installer reach — summary points at
   `/tinyfish:doctor`. Verify failure = warning, not install failure.
5. **Exit codes** — 0 harnesses detected: exit non-zero with "no supported
   harness found" + install pointers. ≥1 detected: exit 0 if ≥1 install
   succeeded (verify warnings don't fail); exit non-zero only if every
   detected harness failed to install. Detect-only outcomes (Hermes/
   OpenClaw fallback, no-TTY auth skip) are excluded from the success/
   failure denominator; an all-detect-only run exits 0 with the pointer
   summary. `--uninstall`: removes CLI-written files, runs
   best-effort `codex mcp remove` / `hermes mcp remove` / `skills`
   removal, prints what it cannot remove (marketplace plugin — point at
   `/plugin uninstall`); exit 0 unless a removal it attempted errored.
6. **Update** — Claude Code: marketplace-native. Codex/Cursor/Hermes/
   OpenClaw: install writes a local version marker (skill-content version
   from this repo's release tag); throttled check (gstack pattern: 5s
   timeouts, cached, semver guard) compares the marker against the latest
   release tag via raw fetch; on drift prints "update available — re-run
   `npx @tiny-fish/cli connect --all`" (npx itself always fetches the
   latest CLI). Claude Code installed via the `--all` OAuth fallback also
   gets the version marker — the marketplace pointer is the recommended
   update story, the marker is its safety net. Never silent mutation of
   agent instruction files.
7. **Telemetry** — `setup_completed` server-side event: per-harness
   `{harness, detected, installed, verify_depth, verify_ok}` for all five
   harnesses + CLI version. `TINYFISH_NO_TELEMETRY=1` suppresses **all
   CLI-emitted analytics** (both the new ping and existing connect-event
   attempt telemetry); README documents exactly what is sent.

## Skills (deepen play)

Content lives in this repo. Single markdown source per skill; a generator
emits per-harness variants **only where an invocation model exists** (per
capability matrix: Claude Code plugin skill, Codex skill file, Hermes skill
file, OpenClaw workspace skill; Cursor gets a passive rules file for
`run`-style context only — doctor/feedback are not shipped to Cursor in v1
since rules cannot be invoked). CI validates generated output (frontmatter
present, description ≤1024 chars — Codex hard limit; marketplace.json schema
+ path resolution — regression guard for #241).

v1 skills:

- **`/tinyfish:doctor`** — diagnose + self-repair: MCP config, key validity,
  CLI install, connectivity. Attacks the post-MCP-setup failure drop-off;
  also the in-harness E2E verifier the installer can't be. Emits a
  **diagnostic report** (E3) built from an explicit field allowlist:
  harness name/version, CLI version, check names + pass/fail, error strings
  from our own tooling **path-redacted before inclusion** (absolute paths
  replaced with `~`-relative or `<redacted>` — ENOENT/spawn errors embed
  home paths). Never included: raw home paths, env dumps, config file
  contents, URLs with tokens, anything credential-derived (SHA-256 lookup
  key only if a key reference is needed). User previews the report before
  anything is filed. Doctor's **repair actions are limited to re-invoking
  `connect` paths** (inheriting installer rigor) — doctor never hand-edits
  config files itself.
- **`/tinyfish:run`** — exists (agent/search/fetch skills); kept as-is.
- **`/tinyfish:feedback`** — structured feedback; v0 files a GitHub issue on
  this repo (public — the doctor-report allowlist above is the privacy
  boundary), attaching the doctor report when present (E3). Filing
  mechanism: the agent uses `gh issue create` when available; fallback is
  a prefilled-URL open with the report body shown to the user to paste
  (URL length limits truncate attachments).

## Testing (full matrix — gstack pattern)

Runner split: CLI suites = vitest (ux-labs convention); cookbook script
gates = `bun:test`. Coverage: syntax gates on scripts; unit tests against
`mkdtemp` sandbox HOME fixtures for **all five harness layouts**
(present/absent/partial; config fresh/merge/corrupt-restore/backup for
CLI-written files; idempotency; uninstall); env seams (`TINYFISH_HOME`,
remote-URL overrides); mocked verify branches (success/auth-fail/
network-fail) per verify depth; update-check throttle + unreachable-remote;
credentials 0600 assertion; doctor-report schema test (allowlist enforced —
a fixture with poisoned paths/tokens must produce a clean report). Three
E2E sandbox-HOME runs: fresh install, re-run idempotent, uninstall-restores.
E4's flag/cohort wiring tests live in ux-labs frontend. CI skill/
marketplace validation as above.

## Telemetry (phased)

- **Phase 1 (now):** server-side only — existing events + client markers
  (`cli_version`, MCP `client_name`, connect attempt IDs) + `setup_completed`
  (schema in flow step 7). Opt-out env var covers all CLI-emitted analytics.
  Installer-success metrics reported separately from activation metrics.
- **Phase 2 (separate spec):** opt-in client diagnostics.

## Onboarding experiment prewire (E4)

A **new, independent feature flag** (not a PROD-4115 variant — adding arms
to a running experiment mid-flight contaminates cohorts) rendering the
`connect --all` one-liner as the onboarding command block. Dormant = flag at
0% rollout, code merged but unreferenced by any live experiment. Activation
requires: PROD-4115 concluded + sign-off from its owner (Kate) + cohorting
keyed on existing `$feature/` conventions. Prewired in v1 so GA is a flag
flip with clean measurement.

## Distribution gates

- **E2 community marketplace** (anthropics/claude-plugins-community):
  **prepared** during v1 (metadata, listing copy, acceptance-criteria review
  — read their requirements before finalizing skill frontmatter). Actual
  submission happens at the GA gate — same bar as E5: no public
  distribution of an unproven flow. (CEO-plan E2 "accepted" = prepare-now,
  submit-at-GA; reconciled with the internal-test status.)
- **E5 public docs page** (docs.tinyfish.ai): deferred to GA,
  post-validation.

## Phases

- **v1 (this spec):** connect --all (5 harnesses per capability matrix) +
  cursor client + rigor (merge/backup on CLI-written files, isolation,
  honest per-depth verify) + doctor (+report) + feedback + generator + CI +
  tests + E4 dormant flag + E2 preparation.
- **v1.1:** `/tinyfish:integrate` — skill guiding the agent to scaffold
  TinyFish (PY/TS SDK, CLI, raw API, MCP) into the user's own codebase;
  highest-leverage per activation data but least-bounded surface; design
  informed by v1 transcripts and coworker feedback.
- **GA:** E2 submission, E5 docs page, harness expansion per evidence
  (Windsurf, Cline, Copilot, Gemini CLI), Windows PowerShell path, canonical
  checkout auto-update if re-run prompting proves too slow, E4 flag
  activation (post-PROD-4115 + owner sign-off), GA owner named,
  npm-published one-liner as the public command, doctor/feedback for Cursor
  if an invocation model appears. Device-code auth: closed — MCP OAuth
  already provides zero-paste on the harnesses that matter; Cursor keeps
  the auth-login paste path.

## NOT in scope (v1)

- Windsurf / Cline / Copilot / Gemini CLI — no GA evidence yet.
- `/tinyfish:integrate` — v1.1 (D10).
- Device-code auth endpoints — superseded by MCP OAuth (D14/D15).
- Silent auto-update / canonical checkout — prompt-to-re-run instead (D8).
- Client-side telemetry — Phase 2.
- E2 actual submission, E5 docs page — GA gate.
- Onboarding-page command replacement — E4 flag stays dormant until
  PROD-4115 concludes.
- Doctor/feedback on Cursor — no invocation model for rules files.
- Per-product skill sprawl; persona-style suites.

## Risks

- **Three-repo coordination** — installer logic in ux-labs CLI (300 LOC PR
  limit, review cycle), skills content here, E4 flag in ux-labs frontend.
  Mitigation: content-only iteration stays on this branch; CLI and frontend
  changes are small and sequenced.
- **Hermes/OpenClaw non-interactive path is new flow code** (M effort) —
  the interactive walkthroughs cannot run under `--all`; if the
  non-interactive shape slips, ship v1 with them detect-only + pointer to
  `connect <client>`, without blocking the other three harnesses.
- **Harness format drift** — generator isolates per-harness output; CI
  validates. gstack precedent: their Codex description-size bug argues for
  the ≤1024-char CI check, which we have.
- **`skills` CLI package dependency** — connect pins `skills@1.5.15`;
  behavior changes upstream could break installs. Pin + test.
- **Public-repo feedback issues** — doctor-report allowlist + user preview
  is the privacy boundary; any allowlist change needs review.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (SELECTIVE EXPANSION) | 5 proposals: 4 accepted (E1–E4, E1 rescoped, E2 gated), 1 deferred (E5) |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR (outside voice) | 12 challenges: 6 folded, 4 decided via D8–D13, 2 already-resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** eng-review outside voice drove verify honesty (9A), integrate deferral (10A), prompt-before-update (8C); mid-review discovery that `tinyfish connect` ships the installer core produced the 15A pivot.

**CROSS-MODEL:** CEO-review adversarial spec loop (fresh-context subagents, grounded in connect.ts): iteration 1 scored the bolted-on union 6/10 with 13 findings; iteration 2 scored the folded spec 8/10 (Scope + Feasibility PASS) with 11 clarity residuals, all fixed (Claude Code --all fallback path, path-redaction scrub, OpenClaw auth-verify + delegated-write correction, non-interactive definition + multi-OAuth UX, detect-only/uninstall exit codes, INSTALL.md ownership, feedback filing mechanism, doctor repair = connect-paths-only, update comparator, runner split). Iteration-1 headline fixes: 5-harness capability matrix now authoritative (fixes scope contradiction, per-harness write/auth/verify/skill semantics), E1 rescoped to non-interactive configure+verify at M effort with detect-only fallback, E2 split prepare-now/submit-at-GA (aligned with E5 bar), E4 defined as independent dormant flag requiring PROD-4115 owner sign-off, doctor report changed to field allowlist + user preview, exit codes enumerated, telemetry opt-out scoped to all CLI-emitted events, INSTALL.md location/exemption stated, tests extended to 5 fixtures + report-schema test.

**VERDICT:** CEO + ENG CLEARED — ready to implement. v1 = extend `tinyfish connect` (cursor client, --all, capability-matrix rigor) + doctor/report/feedback + generator + tests + E4 dormant flag + E2 preparation.

NO UNRESOLVED DECISIONS
