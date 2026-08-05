# TinyFish Setup + Skills — Design

Date: 2026-08-05
Status: approved (London), eng-reviewed, internal test phase
Branch: `tinyfish-setup-skills` (coworker test; not GA)
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
  telemetry with attempt IDs to `/api/cli/connect-event`. This IS the
  installer core; v1 extends it.
- **`tinyfish auth login`** — browser-open + hidden key paste + format
  validation; non-interactive stdin path for CI. Covers harnesses without
  MCP OAuth (Cursor).
- **Claude Code plugin marketplace** — `.claude-plugin/marketplace.json` →
  `plugins/tinyfish` (MCP config + agent/fetch/search skills). Harness-native
  auto-update ("plugins updated, reload").
- **Frontend first-usage polling** (`useSetupUsage`) — onboarding polls
  first-usage signals; reusable later for zero-paste UX, not an auth endpoint.

## Shape (v1, internal test)

Harness scope: **Claude Code, Codex, Cursor.** Others (Windsurf, Cline,
Copilot, Gemini CLI, OpenClaw) wait for GA evidence.

Two honest install paths (not "one universal installer"):

- **Claude Code** — plugin marketplace: `/plugin marketplace add
  tinyfish-io/tinyfish-cookbook` + install. MCP OAuth on first use.
- **Codex + Cursor** — `npx @tiny-fish/cli connect --all` (new flag):
  detects present harnesses, installs per harness, per-harness failure
  isolation, end summary. Agent-prompt fallback/repair: INSTALL.md written
  for agent consumption ("read INSTALL.md, install TinyFish for me").

### `connect --all` flow

1. **Detect** Claude Code / Codex / Cursor config dirs; absent ones skipped
   silently.
2. **Auth** — claude-code/codex: existing MCP OAuth (zero paste). Cursor:
   `auth login` path (browser to dashboard, hidden paste). Non-interactive:
   `TINYFISH_API_KEY` env. Credentials stay in the CLI's existing config
   store: 0600, never echoed, never logged, overwrite only with `--force`.
3. **Configure** — structured configs (Codex TOML, Cursor JSON): parse +
   merge only our entries + timestamped backup before every write + restore
   on parse failure. Marker fences only in plain-text rule files. Idempotent
   re-runs; `--uninstall` removes our entries and leaves user content intact.
4. **Verify (honest scope)** — direct HTTP health + auth check against the
   MCP endpoint, parse-validation of each written config, per-harness ✓/✗
   summary with reason + fix hint. In-harness E2E is explicitly out of
   installer reach — summary points at `/tinyfish:doctor` for that. Verify
   failure = warning, not install failure. Exit non-zero only if all
   harnesses fail.
5. **Update** — Claude Code: marketplace-native. Codex/Cursor: throttled
   version check (gstack pattern: 5s timeouts, cached, semver guard); on
   drift prints "update available — re-run `npx @tiny-fish/cli connect
   --all`". Never silent mutation of agent instruction files.
6. **Telemetry** — `setup_completed` server-side event carrying per-harness
   ✓/✗ so installer success is measured independently of activation.
   `TINYFISH_NO_TELEMETRY=1` skips the ping; README documents exactly what
   is sent.

Onboarding-page integration is deferred until the PROD-4115 experiment
concludes; the command block is under active test.

## Skills (deepen play)

Content lives in this repo. Single markdown source per skill; a generator
emits per-harness variants (Claude Code plugin skill, Codex, Cursor rules).
CI validates generated output (frontmatter present, description ≤1024 chars —
Codex hard limit; marketplace.json schema + path resolution — regression
guard for #241).

v1 skills:

- **`/tinyfish:doctor`** — diagnose + self-repair: MCP config, key validity,
  CLI install, connectivity. Attacks the post-MCP-setup failure drop-off;
  also the in-harness E2E verifier the installer can't be.
- **`/tinyfish:run`** — exists (agent/search/fetch skills); kept as-is.
- **`/tinyfish:feedback`** — structured feedback; v0 files a prefilled GitHub
  issue on this repo.

## Testing (full matrix — gstack pattern)

`bun:test`/vitest with: syntax gates on scripts; unit tests against
`mkdtemp` sandbox HOME fixtures per harness layout (detector present/absent/
partial; config fresh/merge/corrupt-restore/backup; idempotency; uninstall);
env seams in scripts (`TINYFISH_HOME`, remote-URL overrides) so network and
state point at fixtures; mocked verify branches (success/auth-fail/
network-fail); update-check throttle + unreachable-remote; credentials 0600
assertion. Three E2E sandbox-HOME runs: fresh install, re-run idempotent,
uninstall-restores. CI skill/marketplace validation as above. Test plan
artifact: `~/.gstack/projects/*/…eng-review-test-plan….md`.

## Telemetry (phased)

- **Phase 1 (now):** server-side only — existing events + client markers
  (`cli_version`, MCP `client_name`, connect attempt IDs) + `setup_completed`
  with per-harness results. Opt-out env var above. Installer-success metrics
  reported separately from activation metrics.
- **Phase 2 (separate spec):** opt-in client diagnostics.

## Phases

- **v1 (this spec):** connect --all + cursor client + rigor (merge/backup,
  isolation, honest verify) + doctor + feedback + generator + CI + tests.
- **v1.1:** `/tinyfish:integrate` — skill guiding the agent to scaffold
  TinyFish (PY/TS SDK, CLI, raw API, MCP) into the user's own codebase;
  highest-leverage per activation data but least-bounded surface; design
  informed by v1 transcripts and coworker feedback.
- **GA:** harness expansion per evidence, Windows PowerShell path, canonical
  checkout auto-update if re-run prompting proves too slow, onboarding-page
  command swap (post-PROD-4115), GA owner named, npm-published one-liner as
  the public command. Device-code auth: closed — MCP OAuth already provides
  zero-paste on the harnesses that matter; Cursor keeps the auth-login paste
  path.

## NOT in scope (v1)

- Windsurf / Cline / Copilot / Gemini CLI / OpenClaw — no GA evidence yet.
- `/tinyfish:integrate` — v1.1 (D10).
- Device-code auth endpoints — superseded by MCP OAuth (D14/D15).
- Silent auto-update / canonical checkout — prompt-to-re-run instead (D8).
- Client-side telemetry — Phase 2.
- Onboarding-page command replacement — blocked on PROD-4115 conclusion.
- Per-product skill sprawl; persona-style suites.

## Risks

- **Two-repo coordination** — installer logic in ux-labs CLI (300 LOC PR
  limit, review cycle), content here. Mitigation: content-only iteration
  stays on this branch; CLI changes are small and sequenced.
- **Harness format drift** — generator isolates per-harness output; CI
  validates. gstack precedent: their Codex description-size bug argues for
  the ≤1024-char CI check, which we have.
- **`skills` CLI package dependency** — connect pins `skills@1.5.15`;
  behavior changes upstream could break installs. Pin + test.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR (outside voice) | 12 challenges: 6 folded, 4 decided via D8–D13, 2 already-resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** outside voice surfaced the strongest finding indirectly — challenge on verify mechanics (9A) and integrate scope (10A) both accepted; auto-update softened to prompt-before-pull (8C); mid-review discovery that `tinyfish connect` already implements the installer core produced the 15A pivot (extend connect, don't duplicate).

**CROSS-MODEL:** tensions on auto-update (resolved 8C prompt-before-pull), verify (9A direct check), integrate timing (10A defer), adapter generation (11B generator kept per user), telemetry opt-out (12A added), owner timing (13A London now).

**VERDICT:** ENG CLEARED — ready to implement. Scope: v1 = extend `tinyfish connect` (cursor, --all, merge-backup rigor, honest verify) + doctor/feedback skills + generator + full test matrix.

NO UNRESOLVED DECISIONS
