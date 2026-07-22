# Changelog

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
