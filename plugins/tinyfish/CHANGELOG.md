# Changelog

## 1.2.3 (2026-08-17)

### Changed
- Skill: `/tinyfish:doctor` describes `schema_version` `1` and `2`, and bails only above `2`. The CLI now tests an API-key registration on the wire, so a stale key header comes back as a `fail` with a `connect` repair rather than a green check. Without this the 1.2.2 guard would have degraded every user to `--pretty` output the moment that CLI published.
- Skill: `/tinyfish:doctor` states the real gate on Cursor's unattended repair. On `2` it is the CLI's authenticated call passing, not merely a credential resolving, since a revoked key still resolves.

### Added
- Skill: `/tinyfish:doctor` reads `warn`. A warn does not move the exit code and must not be repaired; `registered, API key present but unverified` means doctor cannot read the key's value to test it, which is every Codex install. Step 2 settles those.
- Skill: `/tinyfish:doctor` preserves `repairs[]` order, since `auth login` now precedes `connect` and `connect` writes whichever key is stored.

## 1.2.2 (2026-08-17)

### Fixed
- Skill: `/tinyfish:doctor` reads `schema_version` before the fields it describes — the command pins `@latest`, so a newer CLI can hand it a shape it does not know.
- Skill: `/tinyfish:doctor` no longer implies `auth login` is the only repair that needs a human. `connect <harness>` is `unattended_safe: false` for every harness except Cursor, and Cursor only while the CLI's own credential resolves.
- Skill: `/tinyfish:feedback` files via `--body-file`, not `--body`. The body carries the user's free-form text and doctor's JSON; backticks or `$(…)` in either were evaluated by the filing shell. The URL fallback now says to percent-encode, so a `#` no longer truncates the body.

## 1.2.1 (2026-08-13)

### Fixed
- Skill: `/tinyfish:doctor` step 2 now counts TinyFish MCP servers before proving harness reach. Several can be registered at once against the same endpoint — a plugin, a CLI-written entry, an account-level connector — and a healthy sibling answering the test call was being read as proof that the registration doctor flagged is working. Found by the e2e regression test on a machine with three.

## 1.2.0 (2026-08-13)

### Changed
- Skill: `/tinyfish:doctor` rebuilt on `tinyfish doctor` (CLI 0.18+). The skill no longer re-implements the config checks by hand — it runs the CLI for those, then does the one check the CLI structurally cannot: calling a TinyFish tool through the harness's own MCP client to prove auth end to end. `proves_harness_reach` is always false for OAuth harnesses because the CLI cannot borrow the harness's token.
- Skill: `/tinyfish:feedback` now attaches `tinyfish doctor` JSON verbatim instead of building its own report — the CLI's zod schema is the redaction boundary.

## 1.1.0 (2026-07-21)

### Added
- Bundled remote MCP server (`https://agent.tinyfish.ai/mcp`) via `.mcp.json`, loaded automatically by the plugin system — works in sandboxed surfaces (Claude.ai, Desktop, Cowork) where the CLI can't be installed. In Claude Desktop this still requires one manual "Install" click on the plugin's Connectors tab.
- Skill: `/tinyfish:search` — free, token-efficient web search with recency/date filtering and news/research-paper scoping
- Skill: `/tinyfish:fetch` — free, clean content extraction from up to 10 URLs in parallel
- Skill: `/tinyfish:agent` — browser automation (600 free automation credits for new users, then plan credits), batch runs, and raw CDP browser sessions
- Plugin-level `README.md` with a privacy-policy link and a note on local file access by skills

### Removed
- Skill: `/tinyfish:tunneling` — expose local ports via tinyfi.sh SSH tunnels
- Skill: `/tinyfish:use-tinyfish` — the CLI-based toolkit, replaced entirely by `search`/`fetch`/`agent` so this plugin is MCP-only and works without a local CLI install

## 1.0.0 (2026-04-15)

### Added
- Initial release of the TinyFish CLI plugin for Claude Code
- Skill: `/tinyfish:use-tinyfish` — complete CLI toolkit with 4-tool escalation ladder
  - `tinyfish search query` — web search with ranked results
  - `tinyfish fetch content get` — clean markdown extraction from URLs
  - `tinyfish agent run` — browser automation via natural language goals
  - `tinyfish browser session create` — headless browser with CDP control
- Skill: `/tinyfish:tunneling` — expose local ports via tinyfi.sh SSH tunnels
- Pre-flight checks for CLI installation and authentication
- Marketplace manifest for plugin discovery via `tinyfish-io/tinyfish-cookbook`
