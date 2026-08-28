# Upstream — Design System (LOCKED)

> **Locked 2026-08-21 by Edward from the Claude Design handoff in `docs/design-handoff/`.**
> The three `.dc.html` files there are the visual source of truth — build the app to match them exactly. This file is the extracted token/pattern reference. Screens: `Live Scan`, `Company Read`, `Lead-Time Timeline`.
> Handoff data is illustrative; production uses our researched data (`docs/research/`).

## Character

Warm editorial finance — FT-print-heritage on paper, not a terminal. Sharp corners (zero border-radius anywhere), flat 1px borders, no shadows, ink-on-cream, one rust accent that means "signal."

## Color tokens

| Role | Hex |
|---|---|
| page (paper) | `#f5efe3` |
| panel / card | `#fcf9f1` |
| hairline | `#ddd3c0` |
| hairline, inner (tile footers) | `#eee5d2` |
| section rule (strong) | `#201b13` — section headers/table headers underline in **ink**, not gray |
| ink (text, default chart line) | `#201b13` |
| muted | `#7a7060` |
| **accent rust** | `#a8402a` — links, active nav underline, negative deltas, the signal line, the lead-time band, live/working pulse dots, blinking caret |
| ok green | `#47694f` — completed-agent dots and "✓ Complete" labels only |
| bar track | `#e9e0cd` |

Rust = "the signal / attention here." Ink = neutral data. Green = agent success only. No other colors.

## Type

- **Newsreader** (serif, optical size axis): wordmark (24/600), page headlines (46–50/500, −0.01em), giant numerals (score 76px, timeline "84" at 122px in-SVG, panel score 64px), tile event titles (26/500), evidence quotes (**16.5px italic**), summary-strip numerals (24/500).
- **IBM Plex Sans**: everything else. UI 12.5–13.5px; eyebrows 11px/600/letter-spacing 0.14–0.16em uppercase; `font-variant-numeric: tabular-nums` on all numeric text.
- No monospace anywhere.

## Signature patterns (match handoff exactly)

- **Header** (all screens): serif wordmark + 10px letterspaced "PRIMARY-SOURCE RESEARCH" + nav (active = rust text + 2px rust bottom border) + "● LIVE · Aug 21, 2026 · 09:41 ET" with 2s pulsing rust dot. Bottom border 1px **ink**.
- **Direction score block**: giant serif numeral + "▼ Falling" in rust; context line "was 52 on Jul 22 · −14 vs 30-day baseline"; four component rows `label+weight | 8px bar | score + "was N"` — bar fill ink, **rust only for the family driving the fall**; caption "Components are live; the headline score is smoothed over 7 days."
- **Signal tiles**: panel bg, 1px hairline border, eyebrow label, 30px number + unit, delta line (rust when adverse), 120×40 sparkline (rust for the hero signal, ink otherwise), footer above inner hairline: sources + "scraped N min ago". Leadership tile variant: serif "CEO departure" + ghost serif "8-K" ornament.
- **Evidence table**: 4-col grid (QUOTE / SOURCE / DATE / SCRAPED), header eyebrow row underlined 1px ink, rows separated by hairline; quotes serif italic; scrape column muted tabular ("09:38 ET · 2m ago").
- **Agent rail / scan cards**: complete = green dot + "✓ Complete · 4.1 s" + result stats; working = **rust border on card**, pulsing rust dot, italic progress text ("reading reviews from the last 90 days… 34 of 57"), "Watch the agent's browser →"; queued = transparent bg + dashed hairline border, "waiting for a browser…".
- **Live scan header**: serif ticker input with blinking rust caret (1.1s), 2px ink underline; right side "● 8 agents dispatched / scan started 6.2 s ago · 5 complete · 2 working · 1 queued".
- **Provisional score panel**: score "61" + "provisional ±9 until all sources land"; pending families' bars at 45% opacity or empty with "—"; footnote: "Leadership is excluded until EDGAR completes; remaining weights are renormalized."
- **THE signature — lead-time band**: headline "Customers turned <rust>84 days</rust> before the filing." Chart: ink 2px line on hairline grid; band = rust at 6% opacity between signal-start and filing verticals (1px dashed rust), measurement bracket on top (1.5px rust with end ticks), giant serif rust "84" + letterspaced "DAYS BEFORE THE FILING" inside the band; rust dot at inflection point; official events = 6px ink squares on the baseline with thin leader lines down to labels (filing event in rust); methodology footnote under a hairline; below, three summary strips (SIGNAL START / OFFICIAL FILING / LEAD TIME) with 1px ink top borders — lead-time strip in rust. Tagline register: "Measured, not modeled."

## Typography — why it looks like that (the secret sauce)

1. **Newsreader is an optical-size variable font.** It was designed for on-screen news text and carries an `opsz` axis (6–72): at 46–76px the letterforms automatically get higher contrast, tighter joins, and sharper serifs — display-grade elegance for free. At quote size it relaxes back to a readable text face. This is why the big "84" and the headlines look *expensive* — the font literally changes shape with size. Keep `font-optical-sizing: auto` (default) — never disable it.
2. **Weight restraint.** The serif never exceeds 500–600 at display sizes. Big-and-medium-weight reads editorial; big-and-bold reads like a template. The 76px score is weight 500.
3. **Hard role separation.** Serif = what matters (headlines, verdict numerals, verbatim quotes — always *italic* for quotes). Sans = apparatus (labels, metadata, chrome). The eye learns in seconds that serif means "look here."
4. **Tension of scale, not of color.** 76px numerals against 11px letterspaced uppercase eyebrows (0.14–0.16em tracking) — a ~7:1 size jump in one composition. Color stays almost monochrome so scale does the talking; rust appears only where the product is making its point.
5. **Tabular numerals everywhere** (`font-variant-numeric: tabular-nums`) — numbers align vertically in tables and don't jiggle when live values update. Quiet, but it's half of what makes it feel like a financial instrument.
6. **Negative tracking on display, positive on micro.** Headlines at −0.01em; eyebrows at +0.14em. Standard editorial practice, rarely done in dashboards.
7. **Ink underlines, not gray.** Section headers rule off with 1px `#201b13` — newspaper section rules — while row separators stay hairline `#ddd3c0`. Hierarchy through border color.

## Motion

Pulse (2s / 1.4s) on live dots, caret blink 1.1s. Nothing else. `prefers-reduced-motion`: static.

## Copy register

Understated, factual, editorial. "Evidence, verbatim" · "Every quote links to its source and its scrape." · "Scores update as each agent lands." · "Measured, not modeled." Numbers always carry their baseline ("was 3.8 on Jan 5", "−12% vs 90-day average").
