---
name: doctor
description: Diagnose and repair your TinyFish setup — MCP registration, auth, and connectivity. Runs the TinyFish CLI's own doctor for the config checks, then does the one thing the CLI cannot — proving this harness can actually reach TinyFish. Run when TinyFish tools fail, return auth errors, or after an install that did not verify cleanly.
---

# TinyFish Doctor

`tinyfish doctor` (CLI 0.22+) owns the diagnosis. Your job is to run it, do the one
check it structurally cannot do, and act on what comes back. Never hand-edit config
files — every repair goes through the CLI, which carries backup and merge rigor.

## 0. No shell?

Sandboxed surfaces (Claude.ai, Desktop, Cowork) have no `npx`. If you cannot run
commands, skip to step 2 — it is the more valuable check anyway — then give the user
the command from step 1 to run themselves.

## 1. Run doctor

```sh
npx -y @tiny-fish/cli@latest doctor --harness claude-code
```

JSON on stdout: `schema_version`, `cli_version`, `ok_harnesses`, `ok_cli`, `checks[]`,
`harnesses[]`, `repairs[]`.

Read `schema_version` before the fields. This skill describes `3` (CLI 0.22+). The command
pins `@latest`, so a newer CLI can hand you a shape you do not know: above `3`, stop reading
fields, show the user `--pretty` output instead, and rely on step 2 for the verdict. Below
`3` a single `ok` replaces the two verdicts and `checks[]` carry no `scope`, so read only
`checks[]` and the exit code there.

**Two verdicts, not one.** `ok_harnesses` answers whether the user's agents can reach
TinyFish; `ok_cli` answers whether the CLI's own credential works. `checks[].scope`
(`harness`, `cli`, `info`) says which one a check counts toward, and only the harness scope
moves the exit code — `ok_cli: false` beside exit `0` is a real state, not a contradiction.
Report it as the CLI's own credential, not as a broken harness.

| Exit | Meaning |
|---|---|
| `0` | no harness check failed — `ok_cli` can still be `false` |
| `1` | a harness check failed — read `checks[]` |
| `2` | doctor could not run; **stdout is empty**, the reason is on stderr |

A `warn` is not a failure and does not move the exit code: doctor is saying it could not
check something, not that it is broken. A registration warn whose detail says the key was
not readable, or was not verified, means the key exists but doctor could not test its value
— every Codex install, and any harness whose config redacts the header. Never repair on a
warn, prove it in step 2.

`--pretty` only when showing a human the list. Never put `--debug` output in a report —
it is the one channel carrying raw stacks and absolute paths.

## 2. Prove the harness reach — the part doctor cannot do

`harnesses[].proves_harness_reach` is `false` whenever doctor could not prove that *this*
harness authenticates. It is `true` only where the harness's own client reports a live
connection, or where a key doctor could read verified on the wire — the CLI cannot borrow an
OAuth token, so every harness that reports no connection state leaves the gap to you.

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

What a `registration: pass` proves depends on `schema_version`. On `2` and `3` an API-key
registration was tested on the wire, so a stale key header is already a `fail` with a
`connect` repair beside it. A pass carrying `proves_harness_reach: true` is the harness's own
client reporting a live connection — wire evidence at any version, whatever `auth_mode` says.
Every other pass is presence only: doctor read config, not the wire, and a stale key still
passes while every call 401s. No version says anything about siblings, and a
healthy sibling will answer cheerfully while the broken one stays broken.

## 3. Repair

Run only commands that appear in `repairs[]`, and show `command` before running it. They
arrive as bare `tinyfish …`, which is not on PATH under `npx` — swap that leading word for
`npx -y @tiny-fish/cli@latest` when there is no global install. Keep
the order they arrive in: `action: auth-login` comes before `action: connect` because
`connect` writes whichever key is stored, so a dead one has to be replaced first.

- Terminal with the user present → `npx -y @tiny-fish/cli@latest doctor --fix --harness claude-code`
- Non-interactive → `npx -y @tiny-fish/cli@latest doctor --fix --yes`; only `unattended_safe: true` repairs run and the
  rest return as skipped. Never report a skipped repair as a fix.
- `unattended_safe: false` → hand it to the user, do not run it. Expect most repairs to be
  false: `auth login` always is, and `connect <harness>` is unsafe for every harness except
  Cursor — and on `2` and `3` Cursor only while the CLI's own authenticated call passes, since a
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
