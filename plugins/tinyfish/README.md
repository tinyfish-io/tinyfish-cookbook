# TinyFish

The complete web toolkit for your agent — search, fetch, browser automation, and headless browser control.

## Skills

- **`/tinyfish:tinyfish-mcp`** — built on TinyFish's hosted MCP server (bundled via `.mcp.json`). No install, no CLI, no auth preflight. Works in any environment, including sandboxed surfaces without terminal access.
- **`/tinyfish:use-tinyfish`** — built on the `tinyfish` CLI. For terminal environments where the CLI can be installed (`npm install -g @tiny-fish/cli`).

Both skills expose the same four-tool escalation ladder: search → fetch → browser automation → headless browser session.

## Privacy

TinyFish's privacy policy: https://www.tinyfish.ai/privacy-policy

## Local file access

Neither skill reads local files by default. The only exception is `use-tinyfish`'s optional batch mode (`tinyfish agent batch run --input <file>.csv`), which reads a CSV file the user explicitly provides as a command argument. No skill reads, scans, or uploads local files otherwise.
