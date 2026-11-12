# How Openings works (notes to future me)

If I'm reading this after a break: this is my entry for the TinyFish "Job Portal / Careers Finder"
bounty. I built it from scratch (not a port of BridgeJob, whose job search was only mock data).
Below is what every piece does and *why* I made the choices I did.

## The idea in one paragraph

I set my preferences once (role, locations, internship vs new grad, keywords, whether I need visa
sponsorship, companies I care about). The app then goes out to the live web, finds real openings,
reads them, throws away duplicates and junk, ranks what's left for me, and tells me what's **new
since I last checked**. The point is to stop me refreshing ten careers pages every week.

## The three TinyFish endpoints — and what each one does for me

The bounty pays more for using more endpoints, but only if each one actually matters. So each has a
job that the others can't do:

- **Search = discovery.** I don't know every company hiring interns. Search does. I query things like
  `software engineer intern New York`, restricted to ATS job-board domains (Greenhouse, Lever, Ashby,
  Workday) with `include_domains`. Result: direct links to real postings, from companies I never named.
- **Fetch = reading.** Once I have URLs, Fetch loads them in a real browser and hands me clean text.
  Up to 10 URLs per call, in parallel. That text is where the details I care about live: location,
  pay, grad year, visa. Search and Fetch are both **free**, so they do the heavy lifting.
- **Agent = the hard sites.** Some careers sites are JavaScript apps (Workday, Ashby boards, custom
  company sites) — Fetch gets an empty shell. For those, Agent opens a browser, types into the site's
  search box, and returns JSON. It's **metered** (costs money) and slow (~70s), so it's only for
  sites where Fetch fails.

A mental model: *Search finds the doors, Fetch walks through the open ones, Agent picks the locks.*

## Firecrawl — the backup provider

TinyFish does the work. **Firecrawl only steps in when a TinyFish call fails or comes back empty**, so
one provider having a bad day doesn't sink a run. I kept it strictly a fallback on purpose: this is a
TinyFish bounty and judges look for TinyFish being used meaningfully — Firecrawl is the safety net,
not the engine. It turns on automatically when `FIRECRAWL_API_KEY` is in `.env.local`.

Two places it's used (`src/lib/firecrawl.ts`, plain REST calls to `api.firecrawl.dev/v2`):

- **Search fallback** (`discover.ts`): each query runs on TinyFish Search first. If *that query*
  errors or returns nothing, the same query goes to Firecrawl search with
  `(site:job-boards.greenhouse.io OR site:jobs.lever.co OR …)` added. 2 credits per query.
- **Render fallback** (`pipeline.ts`, step 3b): pages TinyFish Fetch only saw as a JS shell get a
  Firecrawl scrape **before** Agent. A scrape is ~2s and 1 credit; an Agent run is ~1 min and metered.
  Capped at 8 per run — unless Fetch read *nothing*, which means TinyFish is down, and then Firecrawl
  covers the whole read budget.

So the read order for a posting is: **TinyFish Fetch → Firecrawl scrape → TinyFish Agent.**

Real numbers: Red Hat's Workday page was a 425-char shell on TinyFish Fetch and 7,616 chars on
Firecrawl. A Toronto run: Fetch read 12/15, Firecrawl rendered the other 3 in 3.9s. **Outage test**
(`TINYFISH_API_KEY=invalid npm run pipeline`): Firecrawl served all 38 search hits, rendered 8 pages,
and the run still returned clean jobs.

Firecrawl adds site names to titles ("… @ Zip - Jobs", "… - Greenhouse"); `cleanFirecrawlTitle`
strips them.

## Things I learned in the spike (so I don't re-learn them)

- **Search:** plain phrases work. `intern OR internship OR co-op` combined with `include_domains`
  returned **zero** results. So I run one plain query per (location × seniority word) instead —
  e.g. "…intern New York" and "…co-op New York". That took me from 10 results to 38.
- **Ashby pages:** Fetch returns the body in `description` and leaves `text` empty. `read.ts` falls
  back to `description`.
- **Workday pages:** sometimes come back as a ~400-character shell. That's my signal to use Agent.
- **Company-wide job lists:** Greenhouse's feed (`boards-api.greenhouse.io/v1/boards/<company>/jobs`)
  reads fine through Fetch (it comes wrapped in a ``` code fence — strip it). Lever's JSON feed gets
  mangled, but the normal `jobs.lever.co/<company>` page works. Ashby's board page is empty → Agent.
- **Agent:** "COMPLETED" doesn't mean it succeeded. I always check the JSON for an `error` field.
  In my Workday test it also returned an irrelevant "Director, Tax" job — that's why ranking exists.

## How one run flows (Phase 1)

`runPipeline(prefs)` in `src/lib/pipeline.ts` is the whole thing. In order:

1. **Discover, two ways at once.**
   - *Search* (`discover.ts`) — finds postings anywhere on the ATS boards.
   - *Watchlist boards* (`boards.ts`) — if I named companies (e.g. `roblox, figma, palantir`), read
     each company's **full** job list. I don't know which job system a company uses, so I just try both:
     Greenhouse's JSON feed and Lever's board page, each as one Fetch call with all the companies in
     it. Whichever answers wins. A board lists *every* role (Roblox has 200+), so I keep only titles that
     match my seniority and role (`titleMatches`) — "Senior Engineer" and "Marketing Intern" get dropped.
2. **Decide what to read** (`pickToRead`). Fetch reads are my budget (15 by default). Watchlist
   companies get at most half, shared round-robin, so Palantir's 30 intern roles can't crowd out
   everything else. Search results fill the rest. Duplicate URLs count once.
3. **Read** (`read.ts`) — Fetch the chosen postings, 10 per call.
4. **Extract** — turn each page into a `Job`:
   - *Rules first* (`extract/rules.ts`), always. Free, instant, tested. Pulls title, company, location,
     remote/hybrid/onsite, internship vs new grad, term ("Summer 2027"), grad years, pay, visa.
   - *LLM on top* (`extract/llm.ts`), only if an AI Gateway credential exists. It gets the page plus the
     rules' guess and corrects/fills it in (and adds skills + a one-line summary). If the LLM call fails,
     I keep the rules result — a run never breaks because of the LLM.

## When Agent gets used (Phase 2)

Agent costs money and takes ~20–100s per run, so it's **off by default** and every run has a budget
(`agentRuns`, the "Agent runs (metered)" dropdown on the dashboard, `--agent N` in the terminal).
It's used in exactly two places, both for things Search + Fetch *can't* do:

1. **Watchlist companies with no Greenhouse/Lever board.** e.g. Notion (Ashby) or NVIDIA (Workday).
   First, Search finds where their jobs live (`findPortal` in `portals.ts` — free), restricted to
   Ashby/Workday domains, and only accepts a portal whose name looks like the company (so Agent never
   goes to someone else's site). Then Agent opens that portal, uses its search box for e.g.
   "software engineer intern", and returns postings as JSON. Those join the watchlist pool.
2. **Pages Fetch couldn't render.** If Fetch returns under 600 characters (a JS shell like "Careers
   at Red Hat") or nothing at all, Agent opens the posting and returns the full description.

How the budget works (`AgentBudget` in `agent.ts`): I reserve a slot *before* starting a run so
parallel code can't overspend; at most 2 run at once (my wallet's limit); each run is killed after
150s. Portals get the budget first, then shell pages. Every run is logged: purpose, URL, ok/failed,
time, how many postings it found, and a link to the run on agent.tinyfish.ai. While a run is going,
TinyFish also gives a **live view URL of the Agent's browser** — I capture it (`live` event) so the
real app can show it in Phase 4.

"COMPLETED" still doesn't mean success — my goals ask Agent to return `{"error": "..."}` when blocked
or empty, and I treat that as a failed run.

Real numbers: Notion portal search 67–105s → 3 roles; reading one Notion posting 21s.

### The LLM rate limit (and why extraction is batched)

The free Gateway tier allows **5 requests per minute per model**. One call per job meant 13 jobs sat
in retry/backoff for 105s. Now `extractBatchWithLlm` reads **5 postings per call** (3,500 chars each),
so 15 jobs = 3 calls: 6–19s. A rate-limit error isn't account-level, so it just falls back to rules
for that batch.

## Turning results into a shortlist (Phase 3)

This is what makes it a tool instead of a pile of links. It happens in `src/lib/rank.ts`, plus two
cheap checks *before* reading.

**Before reading (saves Fetch reads):**
- Search results whose title is plainly the wrong level ("Senior …", "Director …") are skipped.
- Watchlist board postings already list their location, so ones in the wrong city are skipped.
  In one New York run this skipped 30 postings, and the freed-up reads went to relevant ones
  (11 → 14 matches).

**After extracting, `rankJobs` does three things:**

1. **Dedupe.** Same company + title + location + term = same job, even at a different URL. I keep the
   most complete copy and remember the other URLs ("also posted at 1 other URL"). Different terms stay
   separate — Figma's Summer and Winter internships are different jobs.
2. **Hard filters — with reasons, never silent.** A job is dropped only if it clearly breaks something
   I asked for: wrong level; a location that's definitely elsewhere; "won't sponsor" when I need a
   visa; or a grad-year window I've already graduated past. Every dropped job is listed with why
   ("Located in London, England", "Targets 2026 graduates; you graduate 2027").
   - **Unknown ≠ no.** Missing location stays (marked "Location not stated"); visa "not stated" stays.
   - **Locations** understand aliases (NYC, Brooklyn, SF, Bay Area…) and match whole words, so "NY"
     doesn't match Sunnyvale and "LA" doesn't match Atlanta.
   - **Grad year is deliberately conservative.** "Must graduate before Summer 2028" gets extracted as
     `[2028]`, which *fits* a 2027 grad. So I only drop when I graduate after every listed year;
     otherwise the job stays, marked down 10 with "Mentions 2028 graduates — check eligibility".
     (My first version dropped Notion wrongly — that's how I caught this.)
3. **Score 0–100 with reasons.** Title matches the role (+35, or +20 partial), in my location or remote
   (+20; +5 if not stated), keywords in title/skills/summary (+5 each, max 15), wants my grad year
   (+10), sponsors visas when I need it (+10), on my watchlist (+5), pay listed (+3), term listed (+2).
   Each point comes with a chip on the dashboard: green = why it matched, red = a concern, grey = info.

Checked against the real posting: Garner Health's "No sponsorship" is right ("we are unable to
sponsor or take over sponsorship of an employment visa").

### The `Job` record (`src/lib/job.ts`)

What every result looks like: `title, company, location, workplace, seniority, term, gradYears, pay,
visa, skills, summary` + `id` (hash of the URL, used for dedupe), `applyUrl`, `ats`, `foundBy`
(search / board / agent), `readBy` (fetch / firecrawl / agent), `extractedBy` (rules / llm), `fetchedAt`.

**Visa is three-state on purpose:** `sponsors`, `no_sponsorship`, or `unknown`. Most postings say
nothing — that's `unknown`, not "no". I only mark `no_sponsorship` for explicit refusals like "unable
to sponsor" or "without current or future sponsorship".

### Gotchas I hit in Phase 1

- **Greenhouse feed format flips.** The same URL came back once wrapped in a ``` fence, once with
  markdown escapes (`absolute\_url`). `parseGreenhouseFeed` handles both.
- **SDK gap:** `@tiny-fish/sdk` 0.7.0 doesn't expose `include_selectors`, and its schema rejects unknown
  options. For the Lever board I call the Fetch REST endpoint directly (`fetchRaw` in `tinyfish.ts`)
  with `include_selectors: [".posting"]` — that returns clean HTML per posting that I can parse.
- **Team names look like companies.** Palantir titles end in "- Commercial" / "- US Government". When the
  board already told me the company, I don't split the title.
- **Degenerate pay ranges** like "$62—$62 USD" → shown as "$62 USD".
- **Slug company names** ("Pdtpartners") are the best rules can do from a URL. The LLM fixes these.
- **Dash-suffixes lie.** "… - TOR" is a location, "… - Team Gringotts North" is a Capital One team.
  Rules now only treat a dash-suffix as the company if it matches the company from the URL
  (`sameCompany`); otherwise the URL's company is used and the title stays whole. "@ Company" and
  "at Company" titles are trusted. The LLM prompt also says the draft's company may be a slug, team
  or location and to take the real name from the posting — that's how "Capitalone" becomes
  "Capital One" and a mislabeled "Puck" became "Lyft".
- **AI Gateway free tier limits models.** With the free $5 credits, Claude Haiku 4.5, Gemini 3 Flash and
  DeepSeek are blocked ("Free tier users do not have access to this model"). `openai/gpt-4.1-mini`,
  `gpt-5-mini/nano`, `gemini-2.5-flash(-lite)`, `llama-3.3-70b` and `mistral-small` work. I use
  gpt-4.1-mini. `scripts/models.ts` probes which models the account can call:
  `npx tsx --env-file=.env.local scripts/models.ts openai/gpt-4.1-mini google/gemini-2.5-flash`.
  The LLM is worth it: it cleaned titles, filled locations on search results, and caught
  "sponsor Visa's if needed" (Phoebe) that my regex missed because of the typo.
- **AI Gateway needs a card on file.** I linked the project (`vercel link`), which put a `VERCEL_OIDC_TOKEN`
  in `.env.local` — auth works, but the Gateway refuses requests until a credit card is added in the
  Vercel dashboard (that unlocks the free credits). Until then the dashboard says "Rules (LLM
  unavailable)". The pipeline has a circuit breaker: the first billing/auth/quota error turns the LLM
  off for the rest of the run instead of failing every job. The OIDC token expires after ~12h; rerun
  `vercel env pull .env.local` (answer yes, then re-add `TINYFISH_API_KEY`) or use `AI_GATEWAY_API_KEY`.

## Map of the code

| File | What it does |
|---|---|
| `src/lib/types.ts` | Shared types: `Preferences` (what I want) and `Candidate` (a URL we found but haven't read yet). |
| `src/lib/tinyfish.ts` | Creates the TinyFish client once. Needs `TINYFISH_API_KEY`. Server-only — the key never reaches the browser. |
| `src/lib/ats.ts` | Looks at a URL and says which job system hosts it (greenhouse/lever/ashby/workday/other) and the company's slug. Also knows where each company's full job list lives. |
| `src/lib/discover.ts` | **Search step.** Builds the queries from my preferences and returns de-duplicated candidates. |
| `src/lib/read.ts` | **Fetch step.** Reads pages in batches of 10. Accepts cached pages up to 1h old (`ttl`) — fast rescans, but a closed posting drops off within the hour. Drops pages that fail. |
| `src/lib/boards.ts` | **Watchlist step.** Reads whole company boards (Greenhouse feed, Lever board page) and parses them into candidates with location already filled. |
| `src/lib/job.ts` | The `Job` schema (zod) — shared by rules, the LLM, the API and the UI. |
| `src/lib/extract/rules.ts` | Regex/heuristic extraction. Has tests in `rules.test.ts` with real phrasing from postings. |
| `src/lib/extract/llm.ts` | LLM extraction through Vercel AI Gateway (`generateText` + `Output.object`). Model is `openai/gpt-4.1-mini` unless `EXTRACT_MODEL` is set. |
| `src/lib/rank.ts` | **Shortlist step.** `dedupe`, `matchLocation`, `hardFilter` (returns a reason), `scoreJob` (score + reasons), `rankJobs`. Tests in `rank.test.ts`. |
| `src/lib/pipeline.ts` | **The orchestrator.** Runs everything above in order and reports timings + counts. |
| `src/lib/agent.ts` | **Agent step.** `AgentBudget` (cap, concurrency, timeout, logs, live-view events), `agentSearchPortal` (list postings on a portal), `agentReadPosting` (read one JS-only posting). |
| `src/lib/firecrawl.ts` | Backup provider: `firecrawlSearch` (search fallback), `firecrawlScrape`/`firecrawlScrapeMany` (render fallback, 3 at a time), `cleanFirecrawlTitle`. |
| `src/lib/portals.ts` | Finds a company's Ashby/Workday portal with Search, and `portalRoot` turns any posting URL into the portal's searchable root. |
| `scripts/models.ts` | Probes which AI Gateway models this account can call. |
| `src/lib/progress.ts` | The phase checklist that the dashboard shows. I update it as I finish things. |
| `src/app/page.tsx` | Landing page. |
| `src/app/onboarding/page.tsx` | 4-step preferences setup. |
| `src/app/jobs/page.tsx` | "My radar": scan button, live run panel, filters, ranked cards, sidebar. |
| `src/app/api/run/route.ts` | Streams a run as NDJSON (progress → agent events → result). |
| `src/lib/run.ts` | Request schema + `RunEvent` type shared by the route and the client. |
| `src/lib/useRun.ts` | Client hook that starts a run and follows its stream. |
| `src/lib/prefs.ts` | Preferences, last scan and seen-history in localStorage (guarded), `useSavedPrefs`, `useLastRun`. |
| `src/lib/freshness.ts` | `markNew` (what's new since earlier scans), `isStale`. Tests in `freshness.test.ts`. |
| `src/components/` | `Brand`, `SiteHeader`, `ChipInput`, `jobs/ResultsTable`, `jobs/RunPanel`, `landing/` (`Panel`, `HeroMock`, `FeaturePanels`, `samples.ts`). |
| `DESIGN.md` | Design system extracted from hex.tech with Firecrawl; the source of truth for the look. |
| `src/app/progress/` | The build dashboard (see below). |
| `src/app/api/pipeline/route.ts` | Backend for the dashboard's "Run" button: validates input, calls `runPipeline`, returns jobs + stats. |
| `scripts/run.ts` | Full pipeline from the terminal as a table: `npm run pipeline -- --companies "roblox,figma"`. |
| `scripts/spike.ts` | The Phase 0 spike (raw Search → Fetch, optional Agent with `-- --agent <url>`). |
| `docs/PLAN.md` | The phased plan. |

## The app (Phase 4)

Three real pages, plus the dev dashboard:

- **`/` — landing page (Hex-style).** Hero + layered product mock (dashboard, the Agent's browser on
  Notion's board, a "where matches came from" chart) → strip of the job systems it reads → "Three tools,
  *one* radar" with alternating feature rows for Search / Fetch / Agent, each with a real product panel
  and a "From a real scan" proof line → an evals-style table of extracted postings → "*Honest* by
  default" 2×2 → CTA → FAQ → 4-column footer.
- **`/onboarding` — four quick steps:** role + level → where (up to 3, "Remote" counts) → about you (class
  year, needs visa, skills to boost) → watchlist companies + **Deep search** toggle. Saved in *this
  browser's* localStorage (`src/lib/prefs.ts`) — no accounts. Coming back to edit starts from what's
  saved. Finishing sends you to `/jobs?run=1`, which starts the first scan automatically.
- **`/jobs` — my radar (an app screen, Hex-style).** App bar with the brand, **Deep search** switch and a
  square **Scan again**; tabs for **Matches / Run log / Filtered out** (with counts). Left sidebar: what
  I'm looking for (as key–value rows, with Edit), a "where matches came from" bar chart (Search / Board /
  Agent in the data colours), and what this scan did. **Matches** has four KPI tiles (matches, sponsor
  visas, wants my class year, watchlist), a filter toolbar, and a dense **results table** — score ring,
  role + company, location, term / class, pay, visa, found by. Click a row to expand it: one-line summary,
  "why it matched" chips, skills asked for, provenance (found / read / parsed), and **Apply**. On phones
  the table collapses into stacked rows. **Run log** shows the stage timeline and the Agent's live
  browser while scanning; after a reload it's rebuilt from the saved scan's stats (the live stream is
  gone by then). Starting a scan jumps to Run log; finishing jumps back to Matches. **Filtered out**
  lists every dropped role with its reason.

**How live progress works:** `POST /api/run` (`src/app/api/run/route.ts`) streams **NDJSON** — one JSON
object per line: `progress` (stage, message, `done`), `agent` (started / live URL / step / done), then
`result`. `useRun` (`src/lib/useRun.ts`) reads the stream. Each stage is only ticked off by its own
`done` message, because stages overlap (Search and board reads run in parallel).

**The Agent live view** is TinyFish's `streaming_url`, which their docs say to drop into an iframe
("safe to expose to the browser"). It only exists while the run is going.

**Design:** modelled on **hex.tech** — see `DESIGN.md` at the repo root. I ran the
firecrawl-website-design-clone workflow on hex.tech (Firecrawl `branding` + `images` + a full-page
screenshot, saved in `.firecrawl/`, gitignored) and wrote the tokens into `DESIGN.md`, marking what was
measured vs inferred. Then I rebuilt the app from it: near-white page with a faint mauve cast, plum ink
(`#31263B`), mauve hairlines (`#DBD7DA`), **square** primary buttons, 4px cards, 7px inputs, floating
product panels with soft shadows, and a violet (`#6A4FF0`) reserved for live/data states. Headlines
use Archivo at 115% width (standing in for Hex's commercial PP Formula SemiExtended) with **one word in
Instrument Serif italic** ("Stop refreshing *careers* pages.", "Three tools, *one* radar"). Body is
Geist, labels Geist Mono. Like Hex, the product is the illustration: the landing page's hero is a
layered mock of the real dashboard, filled with **real results from our scans** (`src/components/
landing/samples.ts` — only values that actually came out of the pipeline). Only Hex's visual language
is borrowed; no Hex logos, images or copy. Where Hex shows customer quotes, Openings shows "From a
real scan" proof lines instead — I don't have testimonials and won't invent them.

Real deep-search run: 45 postings found, 15 read, Agent searched Notion's Ashby board (~2.5 min) and
its 3 internships ranked first (80), 2 pages rescued by Firecrawl, 2 filtered out with reasons.

**Bugs I caught while testing this phase:**
- Stages ticked off too early — my hook marked earlier stages "done" when a later one started, but Search
  and board reads run *in parallel*. Now the pipeline sends an explicit `done` flag.
- My find-and-replace for completion messages matched "Agent **read**ing…" (a *start* message) instead
  of "Agent read 1/1" — fixed both.
- "~1 min" for Agent was optimistic; real Notion runs took 67s, 105s and ~145s. Copy now says 1–3 min.

## Freshness: "new since your last scan" (Phase 5)

The point of the whole thing is that I stop refreshing careers pages — so the radar has to tell me
what *changed*. `src/lib/freshness.ts`:

- The browser keeps a **seen history**: job id → when I first saw it (`openings:seen:v1` in
  localStorage, capped at 1,000, oldest dropped first).
- After each scan, `markNew` marks every job not in that history as **new** and adds it. The **first
  scan marks nothing** — "everything is new" says nothing. A scan saved before this feature existed
  seeds the history, so the next scan can already compare.
- The saved scan stores its `newIds` and `previousAt`, so the badges survive a reload.
- On the dashboard: a violet **New** badge on those rows, "**+N new**" on the Matches tab, a "New since
  last scan" tile ("last scan 48 min ago"), and a **New only** filter.
- If the results are **over a day old**, a banner says so and offers Scan again.
- Search is always live; I cut the posting-page cache from 6h to **1h**, so a closed posting drops off
  within the hour.

Tested live: a rescan 48 min after the previous one found **2 new** (a Thomson Reuters co-op and a
Priceline co-op); "New only" showed exactly those two.

**Known gap (from Phase 3):** "New York" also matches *New York State* — the Thomson Reuters co-op is in
Rochester, NY. Fixing it properly needs city-level location parsing.

**Auth — decided not to, for now.** The bounty doesn't need it, judges shouldn't hit a sign-up wall,
and preferences + history already live in the browser. Auth becomes worth it only for scheduled scans
that email me, or syncing across devices. The real risk of a public deploy is **cost** (anyone could run
deep search on my Agent credits), which I'll handle in Phase 6 with rate limiting and a guard on deep
search rather than accounts.

## Going public (Phase 6)

**Live:** https://job-portal-career-finders.vercel.app

**Cost guard** (`src/lib/guard.ts`), because a public URL means strangers can press Scan:
- `/api/run` allows **6 scans per 10 minutes per client** (by IP). In memory, so per server instance —
  Fluid Compute reuses instances so it catches the normal case; a Vercel Firewall rate-limit rule would
  be the stronger version.
- **Deep search (Agent) needs `DEEP_SEARCH_PASSCODE` in production.** Without it the API answers 403
  `deep_search_locked`, and the dashboard shows a small form: enter the passcode (remembered in the
  browser) or "Scan without deep search". Locally, with no passcode set, deep search is open. The real
  passcode is in `.env.local` as a *comment* so local dev stays unlocked.
- `/api/pipeline` (the dev tool behind `/progress`) returns 404 in production, and `/progress` hides its
  runner there.

**Deploying:** `vercel env add` for `TINYFISH_API_KEY`, `FIRECRAWL_API_KEY`, `DEEP_SEARCH_PASSCODE`
(production), then `vercel deploy --prod`. The AI Gateway needs no key on Vercel — it uses OIDC.

**Gotcha I hit:** the first production scan came back `llm: false`. Locally the Gateway token is an env
var (`VERCEL_OIDC_TOKEN` from `vercel env pull`), but on Vercel it arrives *per request* and the AI SDK
reads it itself — so my `llmAvailable()` check said no. It now also treats `VERCEL=1` as available.
After the fix: a production scan in ~28s, 15 matches, all parsed with the LLM ("Doordashcanada" →
"DoorDash").

**Checked on the live site:** all pages 200; `/api/pipeline` 404; deep search without passcode 403; a
real scan streams stage by stage with Firecrawl rescuing 4–5 JS-shell pages.

Demo video: shot list in `docs/DEMO.md`.

## The build dashboard (`/progress`)

`npm run dev`, open http://localhost:3000 (it redirects to `/progress`). Two parts:

1. **Phases** — what's done, what's in progress, what's left. Comes from `src/lib/progress.ts`.
2. **Run the pipeline** — role, up to 3 locations, internship/new grad/any, and optional watchlist
   company slugs (the name in the board URL: `jobs.lever.co/palantir` → `palantir`). Hit Run.
   Four stat boxes show each stage with its time (Search found / Boards listed / Fetch read /
   Extracted by). Below is the table of structured jobs: title + company (links to apply),
   location + remote/onsite, term + grad years, pay, visa, and how it was found (`search · ashby`,
   `board · lever`…). Agent is off unless I pick a number in "Agent runs (metered)"; then a fifth box shows how many
   Agent runs succeeded, and a log lists each run with a link to it on agent.tinyfish.ai.

This dashboard is a dev tool — the "Build log" link in the app header goes here.

## Running it

```
npm install
# .env.local needs TINYFISH_API_KEY (gitignored)
# optional: AI_GATEWAY_API_KEY to turn on LLM extraction (or `vercel env pull` after `vercel link`)
# optional: FIRECRAWL_API_KEY to turn on the Firecrawl fallback
npm run dev        # app at http://localhost:3000 (build dashboard at /progress)
npm run pipeline   # full pipeline in the terminal (add -- --companies "roblox,notion" --agent 2 --keywords "python" --grad 2027 --visa)
npm test           # extraction + board parsing tests
```

## Phases (where I am)

0. Scaffold + spike — done.
1. Pipeline: structured `Job` records + watchlist boards — done.
2. Agent escalation for JS-app sites, with a budget — done.
3. Dedupe + rank, with "why it matched" — done.
4. The real app: landing page + hero, preferences onboarding, jobs dashboard — done.
5. Freshness: "new since your last scan", stale nudge, 1h cache — done.
6. Submission: README, cost guard, deploy — done. Demo video — to record (`docs/DEMO.md`).
