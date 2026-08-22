# Alt-Data Product Anatomy — Research Report

> Research agent output, 2026-08-21. What best-in-class alt-data products put on screen, so ours reads as an analyst tool.

## 1. Product anatomy by vendor

| Vendor | What they actually sell on screen | Core visual unit |
|---|---|---|
| **AlphaSense** | Not a chart product — search/retrieval over filings, expert-call transcripts (Tegus), broker research, news. "Generative Search" produces a synthesized, **fully-cited** answer (every sentence links to a source doc/quote). Deliverable is an *answer with citations*, not a metric. | Cited-answer panel + document viewer |
| **Thinknum Alternative Data** | 35+ raw structured datasets turned into self-serve **time-series charts per company**: job postings by role/location, web traffic, app store data, headcount, store counts. Query, chart, **alert** — no coding. | Per-metric line chart with alerting |
| **Quiver Quantitative** | See §2 — closest free analog. | Ranked table + trending badge + entity page rollup |
| **YipitData** | Finished, presentation-ready deliverables: category spend indices (**Consumer Spend Index**, twice monthly), retailer-vs-retailer share, "polished spreadsheets on demand." Panel-based (12M+ consumers) — panel size = confidence. | Index line vs prior periods + category share bars, delivered as report |
| **Second Measure (Bloomberg)** | Inside the Terminal as `ALTD<GO>` / `ECAN<GO>` — card-transaction panel (23M+ consumers) shown **side-by-side with traditional fundamentals**, daily on a 7-day lag. The UI's whole point is juxtaposition: alt-data line next to reported-revenue line so the analyst eyeballs the gap before earnings. | Alt-data series overlaid on reported-fundamentals series |
| **M Science** | Curated multi-source dashboards narrowed to deeply-covered sectors, paired with analyst-written notes overlaid on charts. Sells *curation + interpretation*. | Sector KPI chart + analyst annotation |
| **LinkUp** | **Compass** macro dashboard: active job openings weekly/monthly, sliceable by geo and industry/occupation. Co-brands the **S&P 500 LinkUp Jobs Index**. | Geo/industry-sliceable index chart, benchmarked to a named index |
| **Revealera / Bloomberry** | Hiring-intentions data (4,000+ companies) + "Growth Trends": product mentions inside job postings and SaaS subscription counts as KPI proxies. | Company-level hiring/product-mention trend, exportable |
| **Glassdoor / Indeed Hiring Lab** | Published macro research (economist charts + commentary) — credibility publication arm, not an entity-level tool. | Macro index chart + written commentary |
| **Placer.ai** | Foot-traffic index per location/chain, day/hour slicing, demographic overlays. Bloomberg `ALTD<GO>` launch partner. | Visits index line + demographic overlay |

**Cross-cutting takeaway:** every serious player either (a) hands you a **named, benchmarked index** comparable period-over-period and against a reference, or (b) hands you a **cited answer** with the source attached. None hand you a wall of raw scraped text.

## 2. Quiver Quantitative — dissected (closest free analog)

**Per-source dashboards:** Congress Trading, Corporate Lobbying, Government Contracts, Insider Trading (Form 4), Institutional Holdings/13F ("Whale Activity"), WallStreetBets mention tracking (back to Aug 2018), App Ratings ("**Hype Score**" = review-volume trend + review-sentiment trend composite), Google Trends, CNBC/Cramer tracker, Patent Grants, Wikipedia page views.

**Entity page pattern (`/stock/AAPL`), confirmed section order:**
1. Header: logo, ticker, live price/change
2. Tabs: Overview / Financials / Forecast / Insiders / Institutions / Compensation / Government / Ownership / News
3. "Strategy Featured" — which factor strategies hold this name
4. Financials
5. Congress Trading table (politician, party, type, dollar-range band, date)
6. Insider Trading table
7. Institutional Owners table
8. Whale Activity — pre-filtered biggest institutional moves
9. Corporate Lobbying (spend by date + issue, back to 1999)
10. Patents, Government Contracts
11. News feed
12. CNBC picks, Top ETF holders, Analyst ratings + price-target range
13. **Smart Score** — 1–10 composite (premium), built from named inputs
14. Bull Case / Bear Case pairs (premium)
15. Profile, exec comp

**Composite score pattern (`/scores/dcinsider`):** 0–100 number averaging three named category sub-scores, shown as a **ranked leaderboard**: rank, ticker+logo, overall score, then the component scores as separate columns. **The single most reusable pattern: one headline number, decomposed into its named inputs, in the same row.** Nothing on Quiver is a raw text feed without a date/amount/party attached.

## 3. What makes analysts trust a signal

- **The commercial case is lead time, not the fact.** Funds pay $500k–$2.5m/yr for "a signal before the traditional disclosure event." UC Irvine study: hiring data leads financial disclosures by ~a quarter.
- **Raw feeds are distrusted until normalized.** Raw → cleaned/normalized/tagged *before* funds act. Normalization is the trust gate.
- **Repeatability beats one-off cleverness.** A signal must work across quarters/companies, not explain one anecdote.
- **Timing precision is a stated metric**: "precedes disclosure by three to five days" — a number attached to the lead, not just "early."
- Pipeline: identify source → extract structured fields → **normalize across sources** → monitor drift → deliver. Failure mode: treating raw counts as comparable across time/companies.

**Implication:** every metric tile needs an explicit "vs. what" — self-baseline (trailing history) minimum, sector peers ideally, and a stated lead-time claim if asserted. A number with no baseline reads as trivia.

## 4. Anti-patterns (what makes tools feel like noise)

- **Raw mention feeds with no weighting** ("25 million sources" volume dumps). Quiver always frames WSB as *trend/rank change over time*, never a scrolling post list.
- **Sentiment without stated method or confidence** — unearned precision fails on sarcasm/context.
- **No baseline = no signal.** "14,203 job postings" means nothing without "vs. last quarter / vs. sector." The #1 amateur-vs-professional tell.
- **Composite scores that hide their inputs** — "Sentiment: 72" with no decomposition is as untrustworthy as a raw feed; can't be audited.
- **No source/evidence trail** — a claim without the clickable underlying document reads as a black box.
- **Generic "deep research" prose** — narrative walls vs structured tables/charts the analyst can sort and re-derive. Even AlphaSense's prose is cited with documents one click away.

**One line:** a signal product answers "is this different from normal, by how much, compared to what" with an auditable number; a social-listening dashboard answers "here's everything people said."

## 5. UI patterns worth stealing

1. **Entity page as the spine** — ticker header → composite score → per-source evidence tables → profile.
2. **Composite score always decomposed in the same view.** Never ship an opaque score.
3. **Delta/change badges, not just levels** — "+X vs last period", ▲/▼ paired with shape not color alone.
4. **Sparklines inline with headline metrics** — a dozen signal tiles scannable per screen (Stripe-dashboard convention).
5. **"What changed this week" as its own module** — ranked biggest movers across all signals; the analyst's first click tells them where to look.
6. **Bracket/range over false precision** — don't over-claim precision the source doesn't have.
7. **Evidence drill-down one hop away** — every asserting row links to its dated, sourced record.
8. **Named, benchmarked indices over raw counts** — give the transformed metric a proper name and a reference to sit against.
9. **Juxtapose alt-data against the thing it predicts** — leading indicator and lagging filing metric on one timeline, so lead time is visually self-evident, not asserted in prose. Highest-leverage visual for this audience.

## Sources

[quiverquant.com](https://www.quiverquant.com/) · [/stock/AAPL](https://www.quiverquant.com/stock/AAPL) · [/scores/dcinsider](https://www.quiverquant.com/scores/dcinsider) · [/sources/appratings](https://www.quiverquant.com/sources/appratings) · [alpha-sense.com](https://www.alpha-sense.com/) · [thinknum.com/datasets](https://www.thinknum.com/datasets) · [yipitdata.com](https://www.yipitdata.com/) · [Bloomberg Second Measure launch](https://www.bloomberg.com/company/press/bloomberg-launches-bloomberg-second-measure-u-s-consumer-spend-index/) · [M Science](https://alternativedata.org/data_provider/m-science/) · [LinkUp S&P 500 Jobs Index](https://www.linkup.com/use-cases/s-p-500-linkup-jobs-index) · [revealera.com](https://revealera.com/) · [hiringlab.org](https://www.hiringlab.org/) · [placer.ai](https://www.placer.ai/) · [Kadoa — alt data for hedge funds](https://www.kadoa.com/blog/alternative-data-for-hedge-funds) · [Young & Calculated — alt data inside hedge funds](https://youngandcalculated.substack.com/p/alternative-data-inside-hedge-funds)
