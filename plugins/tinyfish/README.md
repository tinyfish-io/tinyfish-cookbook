# TinyFish Plugin for Claude

The complete web toolkit for your agent: search the web, fetch any URL as clean markdown, send a browser agent to navigate sites and extract structured data, or take full programmatic control of a headless browser.

All capabilities are provided by the **hosted TinyFish MCP server** (`https://agent.tinyfish.ai/mcp`) — no CLI installation or local runtime is required. The plugin works in Claude Code, Claude Desktop, and Claude.ai; in Claude Cowork, connect the TinyFish connector before starting a session (sign-in cannot be completed from inside a running sandbox).

## Getting started

1. Install the plugin from the marketplace.
2. On first use, sign in to TinyFish when prompted (Claude Code: `/mcp` → `tinyfish` → sign in; Claude Desktop / Claude.ai: Settings → Connectors → TinyFish).
3. Ask Claude to search, fetch, or automate — the `use-tinyfish` skill guides tool selection.

A TinyFish account is required: https://agent.tinyfish.ai

## Example prompts

```text
Search for "OAuth 2.1 best practices 2026" and read the top three results.

Fetch https://example.com/pricing as markdown and summarize the tiers.

Go to https://acme.com/contact and fill out the contact form with
Name: Jane Doe, Email: jane@example.com, Message: "Requesting a demo",
then submit it.

Extract all running shoes from https://nike.com/running as JSON:
[{"name": str, "price": str, "colors": [str]}]
```

## What's included

- **MCP server** (`.mcp.json`): the hosted TinyFish server — search, content fetch, web-agent automation, batch runs, and CDP browser sessions.
- **Skill** `use-tinyfish`: tool-selection guidance — start with the lightest tool (search), escalate to fetch, web agent, or a raw browser session only when needed.

## Data handling

- The plugin itself does not read or write local files and runs no local code; all web access executes on TinyFish's hosted service.
- Content you ask TinyFish to search, fetch, or automate is processed by TinyFish's cloud. See the [TinyFish privacy policy](https://www.tinyfish.ai/privacy-policy).
- Authentication uses OAuth against `agent.tinyfish.ai`; no API keys are stored in the plugin.

## Support

- Documentation: https://docs.tinyfish.ai
- Contact: support@tinyfish.io
