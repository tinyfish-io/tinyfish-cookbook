# Changelog

## 1.1.0 (2026-07-22)

### Changed
- The plugin now connects to the **hosted TinyFish MCP server** (`https://agent.tinyfish.ai/mcp`) via a native `.mcp.json` declaration instead of requiring the TinyFish CLI. It works without any local installation in Claude Code, Claude Desktop, and Claude.ai; in Claude Cowork, connect the TinyFish connector before starting a session.
- Skill `use-tinyfish` rewritten to guide selection over the MCP tools (`search` → `fetch_content` → `run_web_automation` → `create_browser_session`) instead of CLI commands.

### Removed
- Skill `tunneling` (tinyfi.sh SSH tunnels).
- CLI installation and `tinyfish auth login` pre-flight — authentication is now an OAuth sign-in to the hosted server.

### Added
- README with connection instructions, privacy-policy link, and data-handling notes.

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
