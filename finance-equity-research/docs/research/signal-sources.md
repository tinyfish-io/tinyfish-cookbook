# Leading-Indicator Signal Sourcing Report — Equity Research Demo

> Research agent output, 2026-08-21. Feeds the problem/angle brief and source selection.

## 1. Source Map by Signal Category

### A. Customer Sentiment

| Source | URL Pattern | What's Extractable Without Login | Notes |
|---|---|---|---|
| **Reddit** | `reddit.com/r/<subreddit>/search?q=<company>&sort=new`, or `reddit.com/r/<company_sub>/new` | Full post text, comments, upvote ratio, timestamps — all public JSON via `reddit.com/r/<sub>/.json` | Best brand-specific subs are company-named (`r/starbucks`, `r/Tesla`, `r/Target`, `r/CrackerBarrel`, `r/delta`, `r/Boeing` for employees) plus category subs (`r/frugal`, `r/personalfinance`, `r/investing`, `r/wallstreetbets` for retail-investor chatter). Employee-gripe signal lives in `r/antiwork`, `r/recruitinghell`, and company-specific "employees only" threads. |
| **Trustpilot** | `trustpilot.com/review/<domain>.com` | Full review text, star rating, date, reply-from-company, embedded in page's `__NEXT_DATA__` JSON blob — clean structured scrape, no HTML parsing needed | First 10 pages accessible without login/paywall; beyond that it prompts login. Good for velocity (reviews/day) trend, not full historical depth. |
| **Apple App Store (web)** | `apps.apple.com/us/app/<name>/id<appid>` | Star rating, rating count, "What's New" changelog, a sample of written reviews | No login/API key required; ratings histogram + recent reviews visible on page. |
| **Google Play (web)** | `play.google.com/store/apps/details?id=<package>` | Rating, install range, review count, review text via public listing | Same — no auth needed for the listing page itself. |
| **BBB Complaints** | `bbb.org/us/<state>/<city>/profile/<category>/<company>-<id>/complaints` | Complaint count, type, date, status, business response text — ~20 complaints/page, paginated | Complaint text is candid and dated — good for "velocity of complaints" trend line. |
| **ConsumerAffairs** | `consumeraffairs.com/<category>/<company>.html` | Full written reviews with 1-5 star rating, timestamped, category-tagged | Skews negative (selection bias) — treat as complaint-intensity gauge, not overall sentiment. |
| **Downdetector** | `downdetector.com/status/<company>/` | Live report-volume time series (graph + count), user comment snippets, geographic heatmap | Cloudflare-protected but direct HTTP scraping still rated "very easy" as of 2026. The single best **spike-detection** source — report volume jumps in real time during an outage, hours/days before news. |
| **X/Twitter alternative** | Nitter mostly dead; realistic substitute is **Bluesky** (`bsky.app/search?q=<company>`, open firehose API) or leaning on Reddit + Trustpilot | — | Don't promise live Twitter/X scraping on stage — API paywalled, web UI unreliable. Say this explicitly rather than fake it. |

### B. Employee / Hiring Signals

| Source | URL Pattern | What's Extractable | Freshness/Reliability Notes |
|---|---|---|---|
| **Company careers pages via ATS APIs** | Greenhouse: `api.greenhouse.io/v1/boards/<company>/jobs` (public JSON); Lever: `api.lever.co/v0/postings/<company>?mode=json` | Full open-req list with title, department, location, posted date — **no auth needed, public by design** | Cleanest, most demo-safe source in the whole stack. Job-count-by-department over time is a genuine leading indicator of investment vs retrenchment. |
| **Glassdoor** | `glassdoor.com/Reviews/<company>-Reviews-E<id>.htm` | ~3 reviews per unauthenticated pageview before a login modal; undocumented `/bff/` endpoints return more structured JSON | Anti-bot (Cloudflare + login wall) makes this the **flakiest** source for a live demo — have a cached fallback. |
| **Indeed company reviews** | `indeed.com/cmp/<company>/reviews` | Similar partial visibility, heavier bot defenses than Glassdoor | Backup/cross-check only. |
| **layoffs.fyi** | `layoffs.fyi` (searchable table + CSV) | Company, date, # laid off, % of workforce, source link, stated reason | Extremely demo-friendly: clean table, citation-linked. Best **ground-truth companion** for hiring-velocity claims. |
| **WARN Act aggregators** | `warntracker.com`, `layoffdata.com/data/`, `warnradar.com`, `layoffalert.org/states` | Company, state, # affected, filing date, effective date — from state WARN filings (public record) | Official filings, slightly ahead of press but lag decisions by weeks (60-day notice) — corroborating signal. |

### C. Leadership Moves

| Source | URL Pattern | What's Extractable | Notes |
|---|---|---|---|
| **Company newsroom / IR pages** | `investor.<company>.com/news-releases` or `<company>.com/newsroom` | Official press releases, often same-day as internal announcement | Fastest *official* source — ahead of media pickup by hours. |
| **SEC EDGAR full-text search (8-K Item 5.02)** | `efts.sec.gov/LATEST/search-index?q=%22Item%205.02%22&forms=8-K` or per-CIK browse | Structured filings for officer/director departures & appointments; free full-text search | **Ground-truth lag comparison** — legally required within 4 business days. Use to show "Reddit/complaints knew X days before this filing." |
| **Executive-move trackers** | `boardroomalpha.com/executive-moves`, `tracksuccession.com/executive-turnover` | Curated, filterable C-suite move databases (sourced from 8-Ks + proxies) | Easier to query than EDGAR, not ahead of it. |
| **LinkedIn** | Public profiles technically visible logged-out, but aggressive blocking + ToS prohibition | **Do not build the live demo path through LinkedIn.** List as "known but excluded" — a credible engineering call, not a gap. |

### D. Product Momentum

| Source | URL Pattern | What's Extractable | Notes |
|---|---|---|---|
| **Pricing pages** | `<company>.com/pricing` or product listings | Diff current page vs stored snapshot for price changes, tier restructuring, new fees | Static HTML, easy. Wayback Machine (`web.archive.org/web/*/<url>`) provides free historical snapshots to diff against. |
| **Status pages** | `status.<company>.com` (Statuspage.io) | Full incident history with timestamps; public API at `developer.statuspage.io` | Great where it exists (Slack, Stripe, Zoom); consumer brands often lack one — Downdetector fills the gap. |
| **Changelogs / release notes** | App Store "What's New," `<company>.com/changelog` | Release cadence as shipping-velocity proxy | Software-forward companies only. |
| **Web traffic proxies** | `similarweb.com/website/<domain>` (free summary tier) | Directional monthly traffic trend, no login | Estimates — fine for a trend line, don't oversell precision. |

## 2. Freshness / Scrape-Friendliness / Demo-Reliability Ratings

| Source | Freshness vs. filings | Scrape-friendliness | Demo reliability |
|---|---|---|---|
| Downdetector | Real-time (minutes) | Medium — Cloudflare, no login | **High** if the company has an active incident window; zero otherwise |
| Reddit (JSON endpoint) | Real-time to hours | High — public `.json`, no auth | **High** — always has *something* |
| Greenhouse/Lever job APIs | Days to weeks ahead of headcount news | Very High — official public JSON | **Very High** — best "boring but bulletproof" demo leg |
| layoffs.fyi | Same-day to days ahead of filings | High | **High** |
| WARN aggregators | Lags decisions by weeks | Medium-High | **High**, frame as corroboration |
| Trustpilot | Hours to days | High for first 10 pages | **High** |
| BBB / ConsumerAffairs | Days | Medium — pagination-heavy | **Medium** — supporting evidence |
| App Store / Play Store pages | Days | High | **High** |
| Glassdoor / Indeed | Days to weeks | **Low** — login walls, Cloudflare | **Low** — cached snapshot fallback only |
| SEC EDGAR 8-K (5.02) | Ground truth / lag baseline | Very High — official API | **Very High** — the "look how late the filing landed" beat |
| Company newsroom | Same-day, official | High | **High** |
| LinkedIn | N/A | **Very Low** — ToS-restricted | **Do not attempt live** |
| Pricing pages + Wayback diff | Whenever a change happens | High | **Medium** — needs a pre-picked real example |
| Status pages (Statuspage.io) | Real-time | High where hosted | **High** |
| Similarweb (free tier) | Weeks (monthly) | High | **Medium** — directional only |

## 3. Company Candidates for the Live Demo (Aug 2026)

**1. Cracker Barrel (NASDAQ: CBRL) — strongest single candidate.**
CEO Julie Masino stepped down, announced 2026-07-27, effective 2026-08-10 (successor David Deno, ex-Bloomin' Brands CEO), one year after the logo-rebrand backlash. Traffic fell 7.3% YoY, revenue down $47.9M (5.7%), stock down ~55% at crisis peak, $594M market cap erased.
- Sources: SEC 8-K (`sec.gov/Archives/edgar/data/0001067294/000110465926086902/tm2621310d1_ex99-1.htm`); Reddit `r/CrackerBarrel` + food/business subs; news sentiment ran 40-50% negative for three straight months — negative social/complaint sentiment predated the 8-K by roughly a year.
- Directional story: **deteriorating → inflection.** Best "we saw it coming" narrative arc.

**2. Zillow Group (NASDAQ: Z)** — 500 employees (~7%) cut 2026-08-04 despite 18% revenue growth; "flat housing market." Stock down >50% YTD. Sources: careers-page job-count trend, layoffs.fyi, `r/RealEstate`, `r/zillow`. Story: **contraction despite good headline numbers.**

**3. Starbucks (NASDAQ: SBUX)** — union-led boycott through 2026, $1B restructuring closing ~200 stores / 900 jobs, but same-store-sales decline just broke a near-two-year streak — live inflection. Sources: `r/starbucks`, Trustpilot/app reviews ("Green Apron" rollout), Downdetector (mobile app), newsroom vs earnings timing. Story: **improving after a trough** — catching a turnaround, not just decline.

**4. Etsy (NASDAQ: ETSY)** — cut 12% (~220, mostly Product/Eng) 2026-08-05 right after beating Q2; CEO said "not a cost-cutting move." Sources: layoffs.fyi, ATS job-board diff, `r/Etsy` (vocal sellers — two-sided marketplace sentiment), Trustpilot buyer complaints. Story: **seller sentiment vs official framing.**

**5. Tesla (NASDAQ: TSLA)** — Q2 2026 deliveries beat (480,126, +25% YoY, best-ever Q2) yet stock -7.5% same day; 2025 down year (sales -9%, Cybertruck -48%). Sources: `r/Tesla` vs `r/RealTesla` (sentiment divergence), Downdetector (app/Supercharger), 8-K delivery releases. Story: **numbers improving, sentiment still repairing.**

**6. UnitedHealth Group (NYSE: UNH)** — DOJ scrutiny/derivative lawsuit (stock -4.1% after Aug 7 filing), 2% pay-raise cap amid layoffs. Sources: SEC filings (lagging ground truth), layoffs.fyi + WARN, `r/UnitedHealthGroup`/`r/healthinsurance`/`r/medicine`, BBB (huge for a health insurer). Story: **deteriorating, multi-signal convergence** — signal agreement as confidence multiplier.

*Backups:* Southwest Airlines (best-in-class DOT complaint rate but slipping on-time performance + AMFA contract tension); TikTok (250 cut, Nashville closing — weak SEC trail, not a standalone US filer).

## 4. Scoring Frameworks — Alt-Data to Directional Score

- **Signal families, not one number.** Sentiment/complaints, hiring/workforce, web/app traffic, transactional data are the four most widely adopted alt-data types. Build the score as a weighted composite across families so a viewer sees *which* leg drives the read.
- **Velocity over level.** Track rate of change — complaint volume trend, rating trend, sentiment-flip timing — not static snapshots. Headline metric per source should be a week-over-week delta.
- **Hiring velocity as strategy proxy.** Department-level posting trends (Eng reqs falling while Sales holds) read as intentional strategy, distinct from blunt headcount.
- **Backtest framing, stated plainly.** Show historical lead time on a calibration case (Cracker Barrel/Etsy), then apply the same scoring live. "Here's our starting weighting, backtested" beats "this is the industry standard."
- **Starting weights (illustrative, tune per company type):** sentiment 40%, hiring/workforce 30%, leadership stability 20%, product/status incidents 10%; each family scored on trend direction normalized by velocity (magnitude × recency).

## Practical build notes

- **Bulletproof legs:** Greenhouse/Lever job APIs, SEC EDGAR full-text search, layoffs.fyi, Reddit `.json`, Trustpilot `__NEXT_DATA__`.
- **Cached fallback needed for:** Glassdoor/Indeed, Downdetector (highest-risk live call). LinkedIn: never live.
- **Cracker Barrel is the cleanest end-to-end narrative** — lead with it; Zillow or Etsy as the "does this generalize" second example.

## Source links

[layoffs.fyi 2026](https://layoffs.fyi/2026-layoffs/) | [Fast Company — Aug 2026 tech layoffs](https://www.fastcompany.com/91586807/tech-layoffs-august-2026-update-tiktok-etsy-zillow-slash-jobs) | [Cracker Barrel 8-K](https://www.sec.gov/Archives/edgar/data/0001067294/000110465926086902/tm2621310d1_ex99-1.htm) | [CBS News — Cracker Barrel CEO](https://www.cbsnews.com/news/cracker-barrel-ceo-julie-masino-stepping-down/) | [Terakeet — Cracker Barrel crisis](https://terakeet.com/blog/how-cracker-barrels-crisis-rewrote-its-ceos-legacy/) | [Inman — Zillow layoffs](https://www.inman.com/2026/08/04/zillow-lays-off-around-7-of-its-employees-in-latest-layoff/) | [CNBC — Etsy layoffs](https://www.cnbc.com/2026/08/05/etsy-layoffs-q2-earnings.html) | [CNBC — Tesla Q2 2026 deliveries](https://www.cnbc.com/2026/07/02/tesla-tsla-q2-2026-vehicle-delivery-production.html) | [Restaurant Dive — Starbucks same-store sales](https://www.restaurantdive.com/news/starbucks-stanches-the-same-store-sales-bleeding/803927/) | [Boycat — Starbucks closures](https://blog.boycat.io/posts/starbucks-store-closures-900-layoffs-boycott-impact) | [Forbes — Southwest](https://www.forbes.com/sites/christopherelliott/2026/07/19/southwest-is-the-best-us-airline-for-the-second-year-new-study-says/) | [ts2.tech — UNH lawsuit](https://ts2.tech/en/unitedhealth-stock-down-4-1-since-lawsuit-filing-median-target-implies-25-5-upside/) | [ScraperAPI — Trustpilot](https://www.scraperapi.com/blog/scraping-trustpilot-reviews/) | [Scrapfly — Glassdoor](https://scrapfly.io/blog/posts/how-to-scrape-glassdoor) | [Scraperly — Downdetector](https://scraperly.com/scrape/downdetector-status) | [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html) | [Boardroom Alpha — Executive Moves](https://www.boardroomalpha.com/executive-moves) | [Apify — Alt data for hedge funds](https://blog.apify.com/alternative-data-for-hedge-funds/) | [WARNTracker.com](https://www.warntracker.com/)
