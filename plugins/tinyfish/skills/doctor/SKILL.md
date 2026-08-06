---
name: doctor
description: Diagnose and repair your TinyFish setup — MCP config, API key validity, CLI install, and connectivity. Run when TinyFish tools fail, return auth errors, or after an install that didn't verify cleanly. Ends with a working setup or a shareable diagnostic report explaining exactly what's broken.
---

# TinyFish Doctor

Diagnose the TinyFish setup in this harness, repair what you can, and prove
the fix with a real call. Never hand-edit config files — every repair action
re-invokes `tinyfish connect` paths, which carry backup/merge/restore rigor.

## Checks (run in order, report each as pass/fail)

1. **MCP config present** — is the TinyFish MCP server configured in this
   harness? (Claude Code: TinyFish plugin installed; Codex/Cursor/Hermes:
   MCP entry for `https://agent.tinyfish.ai/mcp`.)
2. **Connectivity** — can this environment reach `https://agent.tinyfish.ai/mcp`
   (any HTTP response counts; DNS/TLS/proxy failures fail this check)?
3. **Auth** — call a free TinyFish tool (`search`, one cheap query). Success
   = authenticated. An auth error = key/OAuth problem, not connectivity.
4. **CLI** — `npx @tiny-fish/cli --version` (only if a terminal is
   available). Note the version; failure here is non-fatal (MCP can work
   without the CLI).

## Repairs

- Missing/broken MCP config → run `npx @tiny-fish/cli connect <this-harness>`
  (ask the user before running; show the command first).
- Auth failure on OAuth harness → tell the user the exact re-auth action for
  this harness (e.g. Claude Code: `/mcp` → TinyFish → sign in).
- Auth failure on key-based harness → `npx @tiny-fish/cli auth login`.
- Connectivity failure → report it plainly (VPN/proxy/firewall); nothing to
  repair locally.

After any repair, re-run check 3. Success = show the real result of the test
call — the user should see their agent touch the live web.

## Diagnostic report

When checks fail and repair doesn't fix them, emit a report built from this
field allowlist ONLY:

- harness name + version, CLI version
- each check name + pass/fail
- error strings from TinyFish tooling, with absolute paths redacted to `~/…`
  or `<redacted>` before inclusion

Never include: raw home paths, environment dumps, config file contents, URLs
with tokens, or anything credential-derived (if a key must be referenced,
use its SHA-256 hash, never the key).

Show the report to the user and offer `/tinyfish:feedback` to file it.
