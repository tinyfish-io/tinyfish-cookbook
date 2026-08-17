# TinyFish

The complete web toolkit for your agent — search, fetch, browser automation, and headless browser control.

## Skills

`search`, `fetch`, and `agent` are built on TinyFish's hosted MCP server (bundled via `.mcp.json`). No install, no CLI needed — first use triggers an OAuth sign-in to your TinyFish account (requires an account with available credits). They work in any environment, including sandboxed surfaces without terminal access.

- **`/tinyfish:search`** — free, token-efficient web search with flexible recency/date filtering and news/research-paper scoping
- **`/tinyfish:fetch`** — free, clean content extraction from up to 10 URLs in parallel, including JS-heavy pages
- **`/tinyfish:agent`** — browser automation (600 free automation credits for new users, then your plan's credits): natural-language goals, batch runs across multiple sites, and raw CDP browser sessions

The remaining two are setup tools rather than web tools, and both use your terminal:

- **`/tinyfish:doctor`** — diagnose and repair your TinyFish setup. Runs the TinyFish CLI (`npx @tiny-fish/cli doctor`) for the config checks, then calls a TinyFish tool to prove this agent can actually reach the service. Without a terminal it still runs that second half.
- **`/tinyfish:feedback`** — file a bug report or a doctor diagnostic as a GitHub issue on the public `tinyfish-io/tinyfish-cookbook` repo, via `gh`. Nothing is sent until you approve the exact text.

## Desktop setup note

In Claude Desktop, installing this plugin enables its skills but the bundled `tinyfish` MCP connector still needs one manual step: open the plugin's **Connectors** tab and click **Install** on `tinyfish` before the skills can actually call it.

## Privacy

TinyFish's privacy policy: https://www.tinyfish.ai/privacy-policy

## Local file access

`search`, `fetch`, and `agent` read no local files — every operation goes through the TinyFish MCP server.

The two setup skills do touch your machine:

- **`/tinyfish:doctor`** runs the TinyFish CLI, which reads your agent config directories (`~/.claude`, `~/.codex`, `~/.cursor`, `~/.hermes`, `~/.openclaw`, `~/.config/opencode`) and the CLI credential store (`~/.tinyfish/config.json`) to find where TinyFish is registered. Diagnosis only reads; the repair step rewrites those registrations, and only commands the CLI itself proposes. `doctor` sends no analytics, though a repair re-runs `tinyfish connect`, which does — set `TINYFISH_NO_TELEMETRY` to suppress it.
- **`/tinyfish:feedback`** shells out to `gh issue create` against a public repo, after showing you the exact issue text and waiting for your approval.
