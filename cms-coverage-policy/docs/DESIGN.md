# Coverage Atlas — Design System (LOCKED)

> **Locked 2026-08-21 by Edward from the Claude Design handoff in `docs/design-handoff/Coverage Atlas.dc.html`.**
> That file is the visual source of truth — build to match it exactly (it contains all three screens behind a `screen` prop: map / changes / compare, plus the full status system and interaction logic in its script block). This file is the extracted reference.
> Handoff data is illustrative (its state list and change events differ from our research); production uses our researched data (`docs/research/`).

## Character

Warm, human, reassuring — consumer-health friendliness with professional bones. Cream paper, pill-shaped everything, soft rounded cards, plain-language labels, one calm blue. The credibility device is freshness: "Checked today, 9:14 AM" chips with a green dot, everywhere.

## Color tokens

| Role | Value |
|---|---|
| page | `#FAF7F1` |
| card / header bg | `#FFFDF9` |
| border | `#EDE6DA` (cards) / `#E5DCCC` (chips) |
| quote panel / note panel | `#F7F2E9` |
| chip bg (header sweep chip) | `#F4EFE6` · hover wash `#F1EBE0` |
| ink | `#2E2A24` · headings/quote text `#4A4438` / `#3E392F` |
| body | `#5B5346` · secondary `#6E6557` · faint `#8A8072` · disabled `#B5AA97` |
| **primary blue** | `oklch(0.52 0.13 250)` — nav active pill, buttons, links, tile selection outline; hover `oklch(0.45 0.13 250)`; disabled/checking `oklch(0.65 0.08 250)` |
| fresh green dot | `oklch(0.62 0.14 155)` |
| drop/warn hue | `oklch(0.6 0.13 40)` ring · pill `oklch(0.95 0.03 40)` bg / `oklch(0.5 0.12 40)` text |

### Coverage status system (tile + pill pairs — copy verbatim)

| Status | Label (plain words) | Tile bg / fg | Pill bg / fg |
|---|---|---|---|
| covered | Covered | `oklch(0.62 0.13 155)` / `#FFFDF9` | `oklch(0.93 0.05 155)` / `oklch(0.38 0.1 155)` |
| limits | Covered with limits | `oklch(0.8 0.11 95)` / `#4A3F1E` | `oklch(0.94 0.06 95)` / `oklch(0.42 0.1 85)` |
| prior | Needs prior approval | `oklch(0.78 0.1 60)` / `#4A3320` | `oklch(0.94 0.05 60)` / `oklch(0.45 0.11 50)` |
| not | Not covered | `#EBE4D7` / `#8A8072` | `#EFE9DF` / `#6E6557` |
| none | No published policy | `#FDFCF8` / `#B5AA97`, **1.5px dashed `#D8D0C2` border** | `#F7F4EE` / `#9C917E` |

"Dropped this year" marker: 9px white dot with 2.5px `oklch(0.6 0.13 40)` ring, top-right of tile.
Note: "not covered" is deliberately quiet warm-gray (not red) — absence reads as emptiness, not alarm.

## Type

- **Source Serif 4** (700): page headlines 38px −0.01em, stat numerals 28px, card headlines 21–27px; *italic 400–500* for verbatim policy quotes (14.5–16px, line-height 1.6).
- **Albert Sans** (400–800): everything else. Wordmark 19/800; nav pills 15/500 (active 700); body 15–16; chips 12–14.5/600–700; uppercase micro-labels 12/700/0.06em ("WHAT THE POLICY SAYS, WORD FOR WORD").

## Shape & depth

Pills `border-radius:999px` (nav, chips, status pills, buttons' helper chips); tiles 12px; cards 18–24px; quote figures 14–16px; buttons 14px; logo mark 11px. One soft shadow only, on the map detail card: `0 2px 12px rgba(90,75,50,0.05)`. Tile hover: `translateY(-2px)` 0.12s.

## Signature patterns (match handoff exactly)

- **Header**: 36px blue rounded-square logo (white crescent-dot mark) + "Coverage Atlas" 800; nav = pill buttons (active solid blue/white); right: `#F4EFE6` pill chip "● Agents last swept all 51 policies today, 6:00 AM" (green dot) + avatar circle.
- **Map screen**: condition/program filter chips; serif headline "Where Medicaid covers GLP-1s for weight loss"; three stat cards (serif numeral colored by sentiment: green for coverage count, drop-orange for drops, ink for neutral); 11-column tile grid (gap 7px, aspect 1, 2-letter codes, selection = 3px blue outline offset 2px); legend row of 16px swatches + dropped-marker legend; honest-caption paragraph under the map.
- **Detail card (aside, 440px)**: serif state name + "Checked today, 9:14 AM" chip; status pill (+ "Dropped this year" pill when applicable); kv rows Effective / Run by / Source (source is a link to the actual PDF); **verbatim quote figure**: `#F7F2E9` rounded panel, micro-label "WHAT THE POLICY SAYS, WORD FOR WORD", serif italic quote; for no-policy states a plain-language paragraph instead ("Our agents found no published rule… We re-check every morning and will flag the moment one appears."); full-width blue button **"Check again now"** → checking state "Re-reading the policy…" → chip flips to "Checked just now"; helper caption "Sends a live agent to re-read the official policy page right now."
- **What-changed screen**: vertical timeline — 130px right-aligned date column, 2px `#E5DCCC` rail with 14px dots (drop events `oklch(0.6 0.13 40)`, easings/additions green), rounded cards: serif headline in plain language ("Massachusetts stopped covering GLP-1s for weight loss"), from→to status pills with arrow, optional `#F7F2E9` note panel ("**What happened next:** Prescriptions fell 64% the following quarter."), footer: Effective date · source PDF link · checked-chip right-aligned.
- **Compare screen**: serif "South Carolina vs. Texas"; two state header cards (name + checked chip + status pill + effective/agency/source); rows = 200px label column (+ straw "DIFFERS" pill `oklch(0.93 0.06 85)`/`oklch(0.45 0.1 70)`) and two cells — **plain-language summaries** in the cells; differing cells tinted `oklch(0.97 0.03 95)` with `oklch(0.88 0.06 95)` border; each row has "See exact policy wording ▾" toggle revealing the two verbatim serif quotes side-by-side in `#F7F2E9` panels.
- **Copy register**: plain words over jargon everywhere — "Needs prior approval," "Who qualifies," "How much insulin," "A doctor's order is enough." Reassuring, on the clinician's side, honest about gaps ("Most states haven't opened a pathway yet — that's the honest picture today.").

## Typography — why it looks like that (the secret sauce)

1. **Source Serif 4 is an optical-size variable font** (`opsz` 8–60): at 38px headline size the letterforms sharpen and tighten automatically; in italic quote sizes it stays soft and bookish. Headlines run **700 with −0.01em tracking** — confident but warm because the face itself is humanist.
2. **Albert Sans is a geometric-humanist hybrid** — round enough to feel friendly (health-app energy), structured enough for data. The wordmark at **800** gives brand punch without a logo; body never exceeds 600–700.
3. **Serif = the subject, sans = the interface.** Serif carries state names, headlines, stat numerals, and — always in *italic* — the verbatim policy quotes, so quoted government language is typographically "a document being held up," visually distinct from our UI voice.
4. **Pill geometry as typography.** Status labels live inside `999px` pills with 600–700 weight at 13–14.5px — the label and its color arrive as one unit, which is why statuses read instantly without a legend.
5. **Plain-language labels are a type decision too**: "Needs prior approval," "Who qualifies," "How much insulin" — short human phrases set flush-left in 700 make the compare table scannable like a consumer product, not a policy grid.
6. **Warm ink on warm paper.** Text is `#2E2A24`-family (warm dark brown, never black) on cream — the whole page shares one temperature, which is most of the "aesthetic as hell" effect.

## Motion

Tile hover lift, button checking state, nothing else.

## Build convention (both apps)

Tokens in `@theme` (vanilla CSS custom properties) → Tailwind v4 generates utilities → recurring molecules get **named component classes** in CSS (`.card`, `.status-pill`, `.checked-chip`…) so JSX slaps one or two classes on an element, not a utility soup. If markup needs more than ~4 utilities repeatedly, that's a missing component class.
