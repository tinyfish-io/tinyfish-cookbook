# Changelog

## 1.1.0 (2026-07-21)

### Added
- Bundled remote MCP server (`https://agent.tinyfish.ai/mcp`) via `.mcp.json`, loaded automatically by the plugin system — works in sandboxed surfaces (Claude.ai, Desktop, Cowork) where the CLI can't be installed
- `use-tinyfish` skill now prefers MCP tools when available and skips CLI preflight checks in that case

### Removed
- Skill: `/tinyfish:tunneling` — expose local ports via tinyfi.sh SSH tunnels

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
