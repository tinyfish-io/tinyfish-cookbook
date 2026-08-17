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
npx -y @tiny-fish/cli@latest doctor --harness claude-code
```

JSON on stdout: `schema_version`, `checks[]`, `harnesses[]`, `repairs[]`.

Read `schema_version` before the fields. This skill describes `1` and `2`. The command pins
`@latest`, so a newer CLI can hand you a shape you do not know: above `2`, stop reading
fields, show the user `--pretty` output instead, and rely on step 2 for the verdict.

The difference between the two is what a keyed registration proves. `2` tests an API-key
registration on the wire, so a stale key header fails outright and earns a `connect` repair.
`1` passes it on config presence alone, and step 2 is the only thing that catches it.

| Exit | Meaning |
|---|---|
| `0` | every check passed |
| `1` | a check failed — read `checks[]` |
| `2` | doctor could not run; **stdout is empty**, the reason is on stderr |

A `warn` is not a failure and does not move the exit code: doctor is saying it could not
check something, not that it is broken. On `2`, `registered, API key present but unverified`
means the key exists but doctor cannot read its value to test it, which is every Codex
install and any harness whose config redacts the header. Never repair on a warn, prove it
in step 2.

`--pretty` only when showing a human the list. Never put `--debug` output in a report —
it is the one channel carrying raw stacks and absolute paths.

## 2. Prove the harness reach — the part doctor cannot do

`harnesses[].proves_harness_reach` is `false` whenever doctor could not prove that *this*
harness authenticates. For OAuth harnesses it is always false, because the CLI cannot borrow
the harness's token. You are the only one who can close that gap.

`--harness claude-code` narrows `harnesses[]` to exactly one entry, so there is no ambiguity about which harness it describes.

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

What a `registration: pass` proves depends on `schema_version`. On `2` an API-key
registration was tested on the wire, so a stale key header is already a `fail` with a
`connect` repair beside it. On `1`, and on every OAuth or `auth_mode: unknown` registration
at either version, pass is presence only: doctor read config, not the wire, and a stale key
still passes while every call 401s. Neither version says anything about siblings, and a
healthy sibling will answer cheerfully while the broken one stays broken.

## 3. Repair

Run only commands that appear in `repairs[]`, and show `command` before running it. Keep
the order they arrive in: `auth login` comes before `connect` because `connect` writes
whichever key is stored, so a dead one has to be replaced first.

- Terminal with the user present → `doctor --fix --harness claude-code`
- Non-interactive → `doctor --fix --yes`; only `unattended_safe: true` repairs run and the
  rest return as skipped. Never report a skipped repair as a fix.
- `unattended_safe: false` → hand it to the user, do not run it. Expect most repairs to be
  false: `auth login` always is, and `connect <harness>` is unsafe for every harness except
  Cursor — and on `2` Cursor only while the CLI's own authenticated call passes, since a
  revoked key still resolves as a credential. Read the field, do not infer it.
- OAuth credential failures have no CLI repair: tell the user to run `/mcp`, pick tinyfish, and sign in.

Re-run step 2 after any repair. Success means showing the real search result — the user
should see their agent touch the live web.

## 4. Still broken

Attach doctor's stdout JSON verbatim. It is schema-versioned and already redaction-safe:
undeclared fields are stripped on parse and every message is authored rather than raw. Do
not build your own report, add fields, or paste config contents. On exit `2` there is no
JSON — say so rather than filing an empty report.

Then offer `/tinyfish:feedback` to file it.
