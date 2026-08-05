# TinyFish Setup + Skills — Design

Date: 2026-08-05
Status: approved (London), internal test phase
Branch: `tinyfish-setup-skills` (coworker test; not GA)

## Problem

PostHog funnel data shows large intent-but-fail population: users reach the
onboarding copy-paste step and never succeed, either failing to paste/run the
terminal command (~40% terminal success vs ~98% in-page run) or failing after
attempting MCP setup. Separately, users who touch the API activate at 47–64%
vs 9–15% for agent-only users — deeper surface contact predicts retention.

Two jobs, one system:

1. **Rescue the droppers** — replace the fragile multi-step copy-paste with a
   single installer that automates everything after the first paste.
2. **Deepen the survivors** — skills inside their coding harness that drive
   API/SDK contact.

Prior art proving feasibility: gstack (clone + setup + hourly silent
auto-update + CLAUDE.md registration) and caveman (one `curl | bash`, detects
30+ harnesses, installs per-harness rule/skill files, idempotent, clean
`--uninstall`, agent-prompt repair path).

## Existing foundation (do not rebuild)

`tinyfish-cookbook` already ships a Claude Code plugin marketplace:

- `.claude-plugin/marketplace.json` → `plugins/tinyfish`
- `plugins/tinyfish/.mcp.json` — HTTP MCP server at `https://agent.tinyfish.ai/mcp`
- `plugins/tinyfish/skills/{agent,fetch,search}` — product-surface skills;
  OAuth on first MCP use already works (no manual key paste on this path)

This design extends that plugin; it does not create a parallel skills tree.

## Shape

Two artifacts in this repo:

### 1. Installer (rescue play)

Primary: `npx tinyfish setup` — new command in `@tiny-fish/cli`
(ux-labs `sdk/cli`). Secondary: `install.sh` in this repo, curl-pipeable,
which bootstraps Node if present and runs the same code. Fallback/repair:
agent prompt — "paste into your agent: read INSTALL.md and install TinyFish
for me" (INSTALL.md written for agent consumption).

Flow:

1. **Detect harnesses** — scan known config dirs (Claude Code, Codex, Cursor,
   Windsurf, Cline, Copilot, Gemini CLI, OpenClaw). Install for every harness
   found, caveman-style. Skip absent ones silently.
2. **Auth** — browser device-code handoff; key stored in OS keychain (fallback
   `~/.tinyfish/credentials`). No manual key paste. Skipped when the harness
   path relies on MCP OAuth (Claude Code plugin path).
3. **Configure** — per harness: MCP config where supported; skills/rule files
   everywhere. Idempotent re-runs; marker-fenced blocks in shared files;
   `--uninstall` removes cleanly.
4. **Verify** — live `search` call through the configured surface; print the
   result so the user sees success before the terminal closes.
5. **Auto-update** — hourly throttled, network-failure-safe, silent (gstack
   pattern). Env-var kill switch.
6. **Telemetry ping** — single `setup_completed` server-side event
   (harness list, CLI version).

The onboarding page's command block becomes this one-liner, replacing the
current multi-step arms (interacts with PROD-4115 experiment — coordinate
before touching production onboarding).

### 2. Skills (deepen play)

Extend `plugins/tinyfish/skills/` (Claude Code) with per-harness adapters
generated from the same markdown sources:

- **`/tinyfish:doctor`** — diagnose + self-repair any surface: MCP config,
  key validity, CLI install, SDK env, connectivity. Attacks the
  post-MCP-setup failure drop-off; agent-run diagnosis is what docs can't do.
- **`/tinyfish:run`** — exists today as `agent`/`search`/`fetch` skills; keep.
- **`/tinyfish:integrate`** — scaffold TinyFish into the user's own codebase:
  choose surface (PY/TS SDK, CLI, raw API, MCP) for their use case, write
  working code, run it. Highest-leverage skill per activation data.
- **`/tinyfish:feedback`** — structured feedback, filed to us (endpoint TBD in
  plan; v0 can open a prefilled GitHub issue on this repo).

No per-product skill sprawl in v1; product breadth (agent, browser, fetch,
search, MCP, API, SDKs, CLI) is reached through `run` + `integrate`.

## Telemetry (phased)

- **Phase 1 (this design): server-side only.** Existing PostHog server-side
  events; skills/installer traffic carries client markers (existing
  `cli_version` pattern, MCP `client_name`). One new event: `setup_completed`.
  No consent surface needed.
- **Phase 2 (later, separate spec): opt-in client diagnostics** — harness
  detected, per-step failures, skill invocations. Env-var opt-out, privacy
  note in README.

## Distribution (current phase)

Repo stays effectively local-first: work lands on branch
`tinyfish-setup-skills` pushed to `tinyfish-io/tinyfish-cookbook` for
coworkers to pull and test. No README announcement, no onboarding-page change,
no npm publish of the `setup` command until internal testing passes. GA cut =
merge to main + CLI release via existing release-please pipeline.

## Risks / open items

- **Curl-pipe + enterprise** — npx path primary; script auditable in public repo.
- **Harness format drift** — one markdown source per skill, per-harness
  adapters isolated; CI smoke-tests generated files.
- **Auto-update trust** — releases signed via existing release-please pipeline.
- **PROD-4115 interaction** — onboarding command block is under active
  experiment; installer replaces it only after experiment concludes.
- **Maintenance owner** — unassigned; must be named before GA.
- **Feedback endpoint** — TBD; v0 GitHub issue acceptable.

Out of scope v1: Windows PowerShell installer (fast-follow), per-product
skills, persona-style skill suites, Phase 2 telemetry.
