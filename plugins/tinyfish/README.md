# TinyFish

The complete web toolkit for your agent — search, fetch, browser automation, and headless browser control.

## Skills

All built on TinyFish's hosted MCP server (bundled via `.mcp.json`). No install, no CLI, no auth preflight. Works in any environment, including sandboxed surfaces without terminal access.

- **`/tinyfish:search`** — free, token-efficient web search with flexible recency/date filtering and news/research-paper scoping
- **`/tinyfish:fetch`** — free, clean content extraction from up to 10 URLs in parallel, including JS-heavy pages
- **`/tinyfish:agent`** — browser automation (600 free automation credits for new users, then your plan's credits): natural-language goals, batch runs across multiple sites, and raw CDP browser sessions

## Desktop setup note

In Claude Desktop, installing this plugin enables its skills but the bundled `tinyfish` MCP connector still needs one manual step: open the plugin's **Connectors** tab and click **Install** on `tinyfish` before the skills can actually call it.

## Privacy

TinyFish's privacy policy: https://www.tinyfish.ai/privacy-policy

## Local file access

None of these skills read local files. All operations go through the TinyFish MCP server.
