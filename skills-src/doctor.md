---
name: doctor
description: Diagnose and repair your TinyFish setup — MCP registration, auth, and connectivity. Runs the TinyFish CLI's own doctor for the config checks, then does the one thing the CLI cannot — proving this harness can actually reach TinyFish. Run when TinyFish tools fail, return auth errors, or after an install that did not verify cleanly.
---

# TinyFish Doctor

`tinyfish doctor` (CLI 0.18+) owns the diagnosis. Your job is to run it, do the one
check it structurally cannot do, and act on what comes back. Never hand-edit config
files — every repair goes through the CLI, which carries backup and merge rigor.

## 0. No shell?

Sandboxed surfaces (Claude.ai, Desktop, Cowork) have no `npx`. If you cannot run
commands, skip to step 2 — it is the more valuable check anyway — then give the user
the command from step 1 to run themselves.

## 1. Run doctor

```
npx -y @tiny-fish/cli@latest doctor{{HARNESS_FLAG}}
```

JSON on stdout: `checks[]`, `harnesses[]`, `repairs[]`.

| Exit | Meaning |
|---|---|
| `0` | every check passed |
| `1` | a check failed — read `checks[]` |
| `2` | doctor could not run; **stdout is empty**, the reason is on stderr |

`--pretty` only when showing a human the list. Never put `--debug` output in a report —
it is the one channel carrying raw stacks and absolute paths.

## 2. Prove the harness reach — the part doctor cannot do

doctor sets `proves_harness_reach: false` whenever it could not prove that *this* harness
authenticates. For OAuth harnesses it is always false, because the CLI cannot borrow the
harness's token. You are the only one who can close that gap.

**Count the TinyFish servers first.** A plugin, a CLI-written entry, and an account-level
connector can all be registered at once, all pointing at the same endpoint. doctor inspects
only the one named `tinyfish` and cannot see its siblings. Note which server it reported on.

Then call `search` once with a cheap query, and note which server answered — the tool
namespace names it.

| What happens | What it means |
|---|---|
| Results, from the server doctor reported on | Setup works end to end, whatever `auth_mode` says |
| Results, but from a **different** TinyFish server | Proves nothing about the flagged registration. Report the working server *and* the flagged one as still unverified |
| Auth error, but doctor says `registered: yes` | Registration exists; the credential behind it is broken |
| TinyFish tools absent entirely | Server not loaded in this session — the user must restart the agent |

A `registration: pass` is presence, not proof — doctor reads config, not the wire. A stale
API key in a config header passes that check and still fails every call, and a healthy
sibling server will answer cheerfully while the broken one stays broken.

## 3. Repair

Run only commands that appear in `repairs[]`, and show `command` before running it.

- Terminal with the user present → `doctor --fix{{HARNESS_FLAG}}`
- Non-interactive → `doctor --fix --yes`; only `unattended_safe: true` repairs run and the
  rest return as skipped. Never report a skipped repair as a fix.
- `unattended_safe: false` (`auth login`) → hand it to the user, do not run it.
- OAuth credential failures have no CLI repair: {{REAUTH}}

Re-run step 2 after any repair. Success means showing the real search result — the user
should see their agent touch the live web.

## 4. Still broken

Attach doctor's stdout JSON verbatim. It is schema-versioned and already redaction-safe:
undeclared fields are stripped on parse and every message is authored rather than raw. Do
not build your own report, add fields, or paste config contents. On exit `2` there is no
JSON — say so rather than filing an empty report.

Then {{FEEDBACK}}.
