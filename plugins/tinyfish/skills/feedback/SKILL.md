---
name: feedback
description: File structured feedback about TinyFish — bug reports, confusing setup steps, missing features, or a doctor diagnostic report. Creates a GitHub issue on tinyfish-io/tinyfish-cookbook with the user's approval; nothing is sent without an explicit preview.
---

# TinyFish Feedback

Collect the user's feedback, structure it, preview it, then file it. Nothing
leaves the machine without the user seeing the exact text first.

## Collect

Ask (briefly) for: what they were trying to do, what happened instead, and
what they expected. If `/tinyfish:doctor` produced a diagnostic report this
session, offer to attach it — the report is already redaction-safe (field
allowlist, paths redacted, no credentials); do not add anything to it.

## Structure

```
### What I was doing
…
### What happened
…
### Expected
…
### Environment
harness + version, CLI version (if known)
### Doctor report (optional)
…
```

## Preview gate

Show the complete issue body to the user and ask for an explicit yes before
filing. Any edit they request happens before filing.

## File

- Preferred: `gh issue create --repo tinyfish-io/tinyfish-cookbook --title
  "<short summary>" --body "<body>"` (only if `gh` is installed and
  authenticated).
- Fallback: open a prefilled issue URL
  (`https://github.com/tinyfish-io/tinyfish-cookbook/issues/new?title=…&body=…`).
  URL length limits truncate long bodies — if the body was truncated, tell
  the user and show the full text so they can paste the remainder.

This repo is public — remind the user of that in the preview if the report
contains anything they typed free-form.
