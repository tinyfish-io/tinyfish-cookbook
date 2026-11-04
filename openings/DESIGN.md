# DESIGN.md: hex.tech → Openings

## Source
- URL: https://hex.tech/
- Capture date: 2026-09-29
- Evidence: Firecrawl v2 `/scrape` with `branding`, `images`, `markdown` (`.firecrawl/hex-branding.json`, tokens pulled into `.firecrawl/hex-tokens.json`) and a full-page screenshot (`.firecrawl/hex-screenshot.png`, 1920×13007). Values marked **(observed)** come from Firecrawl's branding output; **(inferred)** values are read off the screenshot/copy and approximated.
- Rights: this file captures Hex's *visual language* only. Hex's logo, customer logos, product imagery and copy are theirs and are **not** reused — Openings supplies its own copy, data and UI.

## Reference Screenshot
![Full-page screenshot of hex.tech](./.firecrawl/hex-screenshot.png)

> The screenshot is a capture of Hex's page, so it is kept locally (`.firecrawl/` is gitignored) and not
> published with this repo. Re-run the Firecrawl scrape in "Rerun Inputs" to regenerate it.

Use this screenshot as the visual source of truth for layout, hierarchy, density, and feel. Tokens below describe the same page in machine-readable form.

## Design Summary
A light, quiet, product-led marketing site. Near-white background with a faint cool-mauve cast; deep
plum-black ink; thin mauve-grey hairlines. Headlines are a **wide (semi-extended) bold sans**, often
paired with **one word set in italic serif** ("*Loved* by the best data teams", "*Instant integration*
with the whole stack"). The page is carried by **large, realistic product UI panels** that float and
overlap with soft shadows — the product *is* the illustration. Buttons are **square-cornered**. Colour
is reserved for data: small multi-hue chart palettes inside the product panels, never on chrome.

## Design Tokens

### Colors
| Role | Value | Source |
|---|---|---|
| Ink / primary text | `#14141C` | observed (`textPrimary`) |
| Primary (brand plum) | `#31263B` | observed (`primary`) |
| Link / plum-2 | `#43394C` | observed (`link`, logo fill) |
| Secondary text (slate) | `#717A94` | observed (`secondary`) |
| Neutral grey | `#717176` | observed (`accent`) |
| Hairline / button border | `#DBD7DA` | observed (secondary button border) |
| Page background | `#F7F6F8` | inferred (near-white, faint mauve) |
| Surface (panels, cards) | `#FFFFFF` | inferred |
| Sunken / table header | `#F1EFF3` | inferred |
| Data palette | violet `#7B61FF`, blue `#4C7DFF`, pink `#E0609E`, teal `#1FA99A`, amber `#E9A23B` | inferred from charts |

Firecrawl reported `colorScheme: dark` because of the dark nav mark; the page itself is light.

### Typography
- Headings: **PP Formula SemiExtended** (observed, commercial). Substitute: **Archivo** at `font-stretch: 115%`, weight 600–700, tight tracking.
- Accent word in headings: italic serif (inferred). Substitute: **Instrument Serif Italic**.
- Body: **Cinetype** (observed, commercial grotesk). Substitute: **Geist**.
- Mono: **Cinetype Mono** (observed). Substitute: **Geist Mono** — used for eyebrows, labels, table headers, numbers.
- Scale (observed): h1 **74px**, body **20px** (hero lede). Inferred: h2 40–48px, h3 22–24px, UI 14–15px, eyebrow 12px mono uppercase with wide tracking.
- Line height: headings ~1.05, body ~1.5 (inferred).

### Spacing And Layout
- Base unit **4px** (observed). Section padding 112–160px desktop, 72–96px mobile (inferred).
- Container ~1200–1280px, centred; long copy capped ~640px (inferred).
- Radius: **4px** default (observed); buttons **0px** (observed); inputs **7px** (observed); product panels 8–10px (inferred).
- Borders: 1px `#DBD7DA` hairlines everywhere; sections divided by hairlines, not colour blocks.
- Shadows: product panels float — `0 1px 2px rgba(20,20,28,.04), 0 24px 48px -24px rgba(49,38,59,.25)` (inferred).
- Hero background: faint technical grid lines (inferred from screenshot).

## Components
- **Nav:** logo left, product links centre, "Sign in" + primary button right; thin bottom hairline.
- **Buttons:** square corners. Primary = solid plum `#31263B`, white text. Secondary = transparent, 1px `#DBD7DA`, ink text. Text links use `→` / `↗` arrows ("Explore self-serve insights →").
- **Product panels:** white, hairline border, 8–10px radius, window chrome (tabs like *Agent / Notebook / App*), dense real-looking UI: tables with mono headers, small charts, chat bubbles.
- **Logo wall:** single row of greyscale wordmarks, evenly spaced.
- **Feature row:** two columns — copy (eyebrow, h3, paragraph, arrow link, customer quote) beside a product panel; alternates sides.
- **Quote:** small, left rule or quote glyph, logo + name + role in mono/small caps.
- **Data table ("Evals"):** mono uppercase headers, hairline rows, pass/fail pills.
- **Cards (use cases / stories):** hairline border, 4px radius, bold title + "↗", short body.
- **FAQ:** narrow centred column, hairline-separated rows with chevron.
- **CTA block:** "Getting started is easy." — small, centred, two square buttons.
- **Footer:** 4 link columns (Company / Platform / Resources / Connect), tiny legal row.

## Page Patterns
Hero (h1 + lede + 2 buttons) → giant layered product mock → logo wall → headline with italic word + intro
→ alternating feature rows with product panels and quotes → dense table panel → product-ethos 2×2 grid →
testimonials → use-case cards → integrations grid → small CTA → FAQ → footer. Mobile: columns stack,
panels scale down and crop rather than shrink text.

## Content Style
Plain, confident, slightly wry ("Everyone's using AI now… and it's a mess."). Short headlines that
state the benefit; one italic word for emphasis. CTAs are verbs: "Get started for free", "Request a
demo", "Explore …". Lots of proof: real-looking data, numbers, named quotes.

## Agent Build Instructions (applied to Openings)
1. Tokens above → CSS variables; light only.
2. Headings in Archivo (115% width, 600) with an optional `<em>` rendered in Instrument Serif italic.
3. Square buttons: plum primary, hairline secondary.
4. Replace illustrations with **Openings' own UI** (run timeline, ranked job cards, the Agent's live
   browser window, an extraction table) built from components and **real results from our scans**.
5. Logo wall → text wordmarks of the job systems Openings reads (Greenhouse, Lever, Ashby, Workday) +
   "Search · Fetch · Agent" — no third-party logo files.
6. Feature rows for TinyFish Search / Fetch / Agent; an "evals"-style table of extracted postings; a
   2×2 "honest by default" grid; FAQ about Openings; 4-column footer.
7. Carry the same tokens into onboarding and the jobs dashboard.

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://hex.tech/
target_stack: Next.js 16 App Router + Tailwind v4
output: DESIGN.md
