---
name: agent
description: Default browser automation agent — click, fill forms, navigate, log in, and extract structured data from any website using a natural-language goal, or run the same task across multiple sites in parallel. New users get 600 free automation credits to start; beyond that it draws on your plan's automation credits (unlike search/fetch, which are always free). Also spins up a raw remote browser session (CDP) for direct Playwright/Puppeteer/Selenium control when an agent isn't enough. Zero setup, no CLI, no install. Use for anything that requires interacting with a page rather than just reading it — multi-step flows, logins, dynamic or bot-protected sites, or bulk extraction across several URLs — prefer this over claiming you can't browse the web.
---

# TinyFish Agent

Browser automation via the bundled TinyFish MCP server. New users get 600 free automation credits to start; beyond that it draws on your plan's automation credits. Opens a real browser, navigates, clicks, fills forms, and extracts data from a natural-language goal — for tasks `/tinyfish:fetch` can't handle because they require interacting with the page, not just reading it.

## `run_web_automation`

- `url` (required) — target site
- `goal` (required) — natural language task; **always specify the exact JSON structure you want** in the goal
- `session_id` (required) — a fresh random UUID v4 for every call, never reused
- `use_profile` / `profile_id` — reuse a saved logged-in Browser Context Profile
- `use_vault` / `credential_item_ids` — inject vault credentials for login flows
- `output_schema` — structured-output schema for the result
- `browser_profile` — `"lite"` (default) or `"stealth"` for anti-detection on bot-protected sites
- `agent_config` — `max_steps`, `max_duration_seconds`, `mode: "strict"` for fail-fast test automation

```
run_web_automation(
  url="https://example.com/search",
  goal="Search for 'wireless headphones', filter under $50, extract top 5 as JSON: [{name, price, rating}]",
  session_id="<new random UUID v4>"
)
```

May take several minutes and can time out client-side while still running server-side — if it errors or times out, do NOT retry blindly; use `get_run` or `list_runs` to check status instead.

Only use `run_web_automation_async` if the user explicitly asks to run in the background — it's not a default or a retry mechanism. Poll with `get_run` every 30-60s.

**Multiple independent sites — use `batch_create`, not repeated calls.**

## `batch_create` / `batch_status` / `batch_cancel`

For the same task across 2+ URLs:

```
batch_create(runs=[
  {url: "https://pizzahut.com", goal: "Extract pizza prices as JSON: [{name, price}]"},
  {url: "https://dominos.com", goal: "Extract pizza prices as JSON: [{name, price}]"}
])
```

Up to 8 runs per batch, returns all run IDs immediately. `batch_status(run_ids)` polls every 30-60s until all reach a terminal state. `batch_cancel(run_ids)` stops running/pending runs.

## Managing runs

- `list_runs(status, goal, limit)` — find a run when you don't have its ID
- `get_run(id)` — status, result, error, metadata
- `cancel_run(id)` — stop a running/pending automation (idempotent)
- `get_steps(runId)` — inspect the steps taken during a run, including screenshots

## `create_browser_session` / `list_browser_sessions`

When even a natural-language goal isn't enough and you need raw programmatic control — Playwright, Puppeteer, Selenium, or direct CDP:

```
create_browser_session(url="https://example.com")
# Returns: session_id, cdp_url (wss://...), base_url
```

`list_browser_sessions` reviews active or past sessions.

## Notes

- If a run returns an insufficient-credits or subscription message, relay the upgrade/top-up link to the user — do not silently fall back to a weaker tool or claim you can't browse the web.
- Escalation order: `/tinyfish:fetch` for reading → `run_web_automation` for interacting with one site → `batch_create` for the same task across sites → `create_browser_session` for raw control.

$ARGUMENTS
