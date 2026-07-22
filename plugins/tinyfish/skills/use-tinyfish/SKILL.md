---
name: use-tinyfish
description: The complete web toolkit for your agent, powered by the hosted TinyFish MCP server. Search the web and get answers in milliseconds. Fetch any URL and get clean markdown back. Send a browser agent to navigate sites, fill forms, and extract structured data. Spin up a headless browser for full programmatic control. Use when you need to search the web, extract/scrape data from websites, handle bot-protected sites, or automate browser tasks using natural language.
---

# TinyFish Web Toolkit

The complete web toolkit — provided by the hosted TinyFish MCP server. Start with the lightest tool that can do the job and escalate only when needed.

## Pre-flight Check (REQUIRED)

Before making any TinyFish call:

1. Confirm the TinyFish MCP tools are available in this session (look for tools such as `search`, `fetch_content`, and `run_web_automation` from the `tinyfish` server).
2. If the tools are missing, or calls fail with an authorization error, stop and tell the user how to connect:
   - **Claude Code:** run `/mcp`, select the `tinyfish` server, and complete the sign-in flow.
   - **Claude Desktop / Claude.ai:** enable the TinyFish connector in Settings → Connectors and complete sign-in.
   - **Claude Cowork:** connect the TinyFish connector *before* starting the session — sign-in cannot be completed from inside a running Cowork sandbox.
3. Re-check tool availability after the user connects, then proceed.

A TinyFish account is required: https://agent.tinyfish.ai

Do NOT proceed until the tools respond.

---

## Picking the Right Tool

```
search  →  fetch_content  →  run_web_automation  →  create_browser_session
lightest                                             heaviest
```

| Tool | When to use | Speed | Cost |
|------|-------------|-------|------|
| **search** | You need to find URLs or get a quick answer about a topic | Fastest | Lowest |
| **fetch_content** | You have URLs and need their clean content (articles, docs, product pages) | Fast | Low |
| **run_web_automation** | You need to interact with a page — click, fill forms, navigate, extract structured data from dynamic sites | Slower | Higher |
| **create_browser_session** | The web agent isn't enough — you need raw programmatic browser control via CDP | Slowest | Highest |

### Full tool inventory

- **search** — web search; returns ranked results with titles, URLs, and snippets.
- **run_big_search** / **get_search_result** — larger indexed search over a topic; submit, then retrieve results.
- **fetch_content** — fetch clean, extracted content from one or more URLs (ads, nav, and boilerplate stripped). Prefer markdown output for reading.
- **run_web_automation** — run a browser automation from a natural-language goal (opens a real browser, navigates, clicks, fills forms, extracts data). **run_web_automation_async** submits and returns immediately; manage runs with **list_runs**, **get_run**, and **cancel_run**.
- **batch_create** / **batch_status** / **batch_cancel** — submit and manage many automation runs at once.
- **create_browser_session** / **list_browser_sessions** — spin up a remote headless browser; returns a CDP WebSocket URL for use with Playwright, Puppeteer, or any CDP client.
- **get_search_usage** / **list_fetch_usage** — check usage.

### Common Patterns

**Research: search → fetch_content**
Search for a topic, then fetch the best results to read their full content.

**Deep extraction: search → run_web_automation**
Search to find the right site, then use the web agent to interact with it and extract structured data.

**Escalation: fetch_content → run_web_automation**
Try fetch_content first. If the page is dynamic/JS-heavy and the fetch returns empty or incomplete content, escalate to the web agent.

**Full control: run_web_automation → create_browser_session**
If the web agent can't handle a complex multi-step workflow, spin up a raw browser session and automate it yourself via CDP.

### Writing automation goals

**Always specify the JSON structure you want in the goal**, e.g.:

> Extract all products as a JSON array: `[{"name": str, "price": str, "url": str}]`

**Parallel extraction — when hitting multiple independent sites, make separate `run_web_automation` calls (they can run concurrently). Do NOT combine multiple sites into one goal** — a single combined goal is slower and less reliable.

---

## General Notes

- **Match the user's language**: respond in whatever language the user writes in.
- Prefer the lightest tool that can do the job; escalate only when a lighter tool falls short.

$ARGUMENTS
