---
name: feedback
description: File structured feedback about TinyFish — bug reports, confusing setup steps, missing features, or a doctor diagnostic report. Creates a GitHub issue on tinyfish-io/tinyfish-cookbook with the user's approval; nothing is sent without an explicit preview.
---

# TinyFish Feedback

Collect the user's feedback, structure it, preview it, then file it. Nothing
leaves the machine without the user seeing the exact text first.

## Collect

Ask (briefly) for: what they were trying to do, what happened instead, and
what they expected. For anything setup-, auth-, or connectivity-shaped, run
`npx -y @tiny-fish/cli@latest doctor` and offer to attach its stdout JSON
verbatim — it is schema-versioned and already redaction-safe (undeclared
fields stripped on parse, messages authored rather than raw). Do not add
fields, summarise it, or paste config contents alongside it. On exit `2`
doctor produced no JSON — say so instead of attaching an empty report.

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
`tinyfish doctor` stdout, verbatim
```

## Preview gate

Show the complete issue body to the user and ask for an explicit yes before
filing. Any edit they request happens before filing.

## File

- Preferred: write the body to a file, then
  `gh issue create --repo tinyfish-io/tinyfish-cookbook --title "<short
  summary>" --body-file <path>` (only if `gh` is installed and
  authenticated). Never interpolate the body into the command — it carries
  the user's free-form text and doctor's JSON, and backticks or `$(…)` in
  either would be evaluated by your shell.
- Fallback: open a prefilled issue URL
  (`https://github.com/tinyfish-io/tinyfish-cookbook/issues/new?title=…&body=…`).
  Percent-encode both values — an unencoded `#` truncates the body and `&`
  splits it into junk parameters. URL length limits truncate long bodies
  anyway — if the body was truncated, tell the user and show the full text
  so they can paste the remainder.

This repo is public — remind the user of that in the preview if the report
contains anything they typed free-form.
