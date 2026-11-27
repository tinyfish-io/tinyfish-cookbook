# Medicare/Medicaid Coverage Data Landscape — Research Report

> Research agent output, 2026-08-21. Where the rules live, change feeds, demo conditions, schema, scrape difficulty. Live-tested: cms.gov and ahca.myflorida.com returned 403 to a plain fetcher; Noridian refused connection — government bot protection is real, plan for browser-grade agents.

## 1. Data Landscape

### Medicare: MCD, LCDs, MAC jurisdictions

The **Medicare Coverage Database (MCD)** at `cms.gov/medicare-coverage-database/search.aspx` is the single CMS-run repository for all NCDs, NCAs, LCDs, Proposed LCDs, and coverage Articles. One canonical entry point — no need to scrape 12 MAC sites for authoritative text, only to resolve which of ~340 NCDs and thousands of LCDs apply to a state.

Confirmed URLs:
- Search: `https://www.cms.gov/medicare-coverage-database/search.aspx`
- LCD view: `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33822` (L33822 "Glucose Monitors"); versioned via `&ver=10`
- NCD detail: `.../details/ncd-details.aspx?NCDId=222` (NCD 40.2 Home Blood Glucose Monitors); also `.../view/ncd.aspx?NCDId=92` (40.3 Closed-Loop)
- Proposed LCDs carry a **DL** prefix before finalizing to **L**
- **Final LCDs by State report**: `.../reports/local-coverage-final-lcds-state-report.aspx` — the single most useful page: all final LCDs for a state without doing MAC math
- **What's New (change feed)**: `.../reports/local-coverage-whats-new-report.aspx?contractorName=all`
- **Proposed LCDs reports**: `.../reports/local-coverage-proposed-lcds-alphabetical-report.aspx?proposedStatus=all`

**MAC jurisdiction → state mapping:** CMS "Who are the MACs" page publishes a state-by-state PDF (`cms.gov/files/document/macs-state-dec-2020.pdf`). Two separate maps:
- **A/B MACs** (physician & institutional) — e.g. J15 = KY+OH (CGS); J5 = IA/KS/MO/NE (WPS); JF = AK/AZ/ID/MT/ND/OR/SD/UT/WA/WY (Noridian).
- **DME MACs** (durable medical equipment — governs CGMs, pumps, wheelchairs) — 4 jurisdictions (A/B/C/D), a **completely different regional split**. CGM questions route through the DME map, not A/B. Don't conflate.
- CA and NY have north/south sub-jurisdictions for certain LCD types — special-case in the resolver.

MCD search filters by state, contractor, keyword, doc type. Classic ASP.NET (viewstate-heavy) — hard for lightweight scrapers.

### Medicaid: no federal aggregator, PDF-heavy, 50 formats

No CMS-run cross-state Medicaid coverage database exists. Each state publishes its own PDL / fee schedule / PA criteria independently. Live-pulled examples:

| State | Where | Format | Cadence |
|---|---|---|---|
| **Texas** | `txvendordrug.com` (HHSC Vendor Drug Program) | HTML landing + PDL PDF | Semi-annual; announced at `txvendordrug.com/about/news` |
| **California** | `medi-calrx.dhcs.ca.gov` (Medi-Cal Rx, contracted PBM) | Searchable HTML Drug Lookup + Contract Drugs List PDFs | **Monthly "Changes to the CDL" bulletin PDF** — closest thing to a real Medicaid changelog |
| **New York** | `newyork.fhsc.com` (Magellan, NY's PBM — off-.gov domain) | PDF only (`NYRx_PDP_PDL.pdf` + quick list) | Rolling; `emedny.org` links out |
| **Florida** | `ahca.myflorida.com` (AHCA) | PDF only, effective date in filename | ~Quarterly (P&T Committee cadence). 403s plain fetchers. |
| **Ohio** | `medicaid.ohio.gov` / `spbm.medicaid.ohio.gov` | PDF (`UPDL Effective 1.1.26.pdf`) | Quarterly. Notable: Ohio unified FFS **and all MCOs** onto one Unified PDL via a single state-run PBM — unlike most states where each MCO runs its own formulary on top |

Patterns: PDF dominates; a minority (CA) offer searchable HTML; several states outsource the PDL to a PBM on a third-party domain (the "official" URL isn't always `.gov` — keep a state→hosting-domain lookup). None expose an API.

**Aggregators for validation, not primary sourcing:** KFF State Health Facts Medicaid PDLs (`kff.org/state-health-policy-data/state-indicator/medicaid-preferred-drug-lists/`), MACPAC drug coverage comparison.

**The one real federal API:** **State Drug Utilization Data (SDUD)** at `data.medicaid.gov` (Socrata/DKAN JSON API). Not coverage/PA data — per-state, per-NDC prescription counts and dollars by quarter. Strong *secondary signal*: utilization cratering right after a PDL change corroborates a detected coverage delta. Easiest source in this report; zero scraping.

### NCDs as federal baseline

~340 NCDs set the nationwide floor/ceiling; MACs write LCDs to fill gaps or add jurisdiction detail. Demo-relevant: **no comprehensive NCD for CGMs** — closest are NCD 40.2 and 40.3; CGM-specific criteria actually live at the **LCD** level (L33822, L38662 implantable). Clean illustration: "the federal baseline is thin here, so state/MAC variation is where the real story is."

## 2. Change Tracking

**Medicare — a real structured feed; build on it:**
- CMS captures LCD/Article changes every **Sunday midnight**, publishes the following **Thursday**. Weekly cadence — poll weekly-Thursday, not daily.
- **What's New Report** = the single feed of all LCD/Article changes per weekly cycle, filterable by contractor. Three months of deltas = 12-13 weekly snapshots.
- **Proposed LCDs report** (DL-prefixed) = forward-looking "coming changes" view, distinct from retrospective.
- **Final LCDs by State report** = current snapshot to diff against.

**Medicaid — no equivalent; the scraper does real work:**
- No federal "what changed" feed. TX announces via news posts semi-annually; CA publishes a monthly change bulletin; FL and OH just republish a new dated PDF with no changelog — **you snapshot-and-diff PDFs yourself**.
- Practical asymmetry worth stating in the demo: for Medicare you *read* a change feed; for Medicaid you *compute* the delta from periodic snapshots. This is the strongest justification for a live web-agent scanner vs a static dataset — Medicaid literally has no API or feed to poll.

## 3. Demo-Friendly Conditions

1. **GLP-1s for obesity (Wegovy, Zepbound) — best headline demo.** Obesity-indication coverage is *optional* for state Medicaid (diabetes/CVD/sleep-apnea indications federally mandated), splitting on state budget appetite (>$1,000/month list). ~11-13 states cover under FFS as of mid-2026. 2026 churn: **CA, NH, PA, SC eliminated obesity coverage after Oct 2025; NC dropped Oct 2025 then reinstated Dec 2025; UT pilot ended 2026-06-30; MA ended 2026-07-01.** Live, multi-directional, three-month-old story. Sources: KFF GLP-1 tracker, TheRxIndex monthly tracker.
2. **CGMs.** No comprehensive NCD, so criteria diverge by state and MAC. **DE, IN, KY, NY, MN dropped PA entirely** for pharmacy-benefit CGM; **AZ, KS, NJ, NM, HI have no published FFS coverage** (MCO discretion). Clean map pair: NY (no PA) vs NJ (nothing published). Sources: CHCS state-by-state report, T1D Exchange.
3. **Cell/gene therapy — sickle cell (Casgevy/Lyfgenia) vs SMA (Zolgensma).** Sickle cell: CMS's voluntary CGT Access Model, **33 states + DC + PR joined** (84% of Medicaid sickle-cell beneficiaries), outcomes-based clawbacks — coordination narrows variation. Zolgensma: no federal model, "marked state-to-state variation." Good counter-example pairing.
4. **Hepatitis C DAAs.** Historic textbook case: fibrosis-stage and sobriety restrictions as cost controls; legal challenges forced easing — 32 of 39 studied states eased 2015–2019 (+966 treatment courses per 100k/quarter where eased). Shows multi-year trend capability.
5. **ABA therapy / autism.** EPSDT mandates coverage under 21, but "medical necessity," auth frequency, hour limits are state-defined; states now cutting (NC: $122M FY22 → projected $639M FY26; IN stops adult ABA Oct 2026; CO sued over new PA). Fresh, contentious 2026 activity.
6. **Buprenorphine/OUD.** 32 states required PA for ≥1 formulation; PA presence correlates with state partisanship and MCO profit status (Health Affairs) — variation driven by politics, not just dollars.

**Recommendation: lead with GLP-1 (freshest churn) + CGM (clean binary map), gene therapy as the coordination counter-example.**

## 4. Normalized Coverage-Record Schema

```
CoverageRecord {
  // Identity
  record_id            // hash of (condition_code, treatment_code, state, program) for delta keying
  condition            // normalize to ICD-10 where possible
  treatment            // e.g. "Continuous Glucose Monitor"
  treatment_code       // HCPCS (Medicare DME) | NDC (drugs) | CPT — actual billing code

  // Jurisdiction
  state                // 2-letter USPS
  program              // medicare | medicaid_ffs | medicaid_mco
  administering_entity // MAC name + jurisdiction, or state agency / MCO name
  mac_jurisdiction     // e.g. "JD DME"; null for Medicaid

  // Coverage substance
  coverage_status      // covered | covered_with_pa | covered_with_limits | not_covered | no_published_policy
  criteria_summary     // normalized short text: PA reqs, thresholds (BMI, A1c, fibrosis stage), limits
  criteria_raw_excerpt // VERBATIM snippet from source — audit trail
  step_therapy_required
  quantity_limit

  // Provenance & change tracking
  source_doc_id        // L33822, NCD 40.2, state PDL doc name/version
  source_doc_type      // lcd | ncd | proposed_lcd | state_pdl | state_pa_criteria | state_fee_schedule
  source_url
  effective_date
  last_revised_date
  last_checked_at      // when our scanner last confirmed this record
  content_hash         // hash of criteria_raw_excerpt + coverage_status → cheap delta detection

  // Delta support
  superseded_by        // link to newer record on change
  change_type          // new_pa_requirement | pa_removed | coverage_added | coverage_dropped |
                       // criteria_narrowed | criteria_broadened | limit_changed
}
```

Delta approach: per scrape, compute `content_hash` per (condition, treatment, state, program); on change, emit a new version with `superseded_by` and infer `change_type` from **structured sub-fields** (status, PA flag, limits) — free-text diffing across PDF re-extractions is noisy (whitespace/OCR artifacts); keep the raw excerpt for human audit, not as diff key. Medicare: one LCD expands into up to 50 state rows via the static MAC→state table without re-scraping. Medicaid: each state is a genuinely separate scrape target.

## 5. Scrape Difficulty by Source Class

| Source class | Format | Difficulty | Notes |
|---|---|---|---|
| MCD (cms.gov) search/view/What's New | ASP.NET HTML | **High** | Live-tested 403 on plain fetch. Needs real browser context (stealth profile), pacing. Structure is regular once rendered — barrier is access, not parsing. |
| MAC provider portals (Noridian etc.) | HTML | **High** | Connection refused on direct fetch; possibly geo/IP-gated. Real browser required. |
| CMS MAC-jurisdiction PDFs | Static PDF | **Low** | Simple, ~annual updates; same cms.gov gate to reach the link. |
| data.medicaid.gov SDUD | JSON API | **Low** | Genuine REST API. Build the utilization cross-check on this first — zero scraping. |
| State PDLs, PDF states (FL, TX, OH, NY) | PDF | **Medium-High** | No login walls, but multi-column PDF tables (some image-embedded). Needs layout-aware extraction + per-state template tuning. FL 403s plain fetchers. |
| State PDLs, HTML states (CA Medi-Cal Rx) | JS search tool | **Medium** | Queryable UI; drive via browser automation, simulate the search interaction. |
| PBM-hosted state pages (NY fhsc.com) | PDF | **Medium** | No bot gate, but off-.gov domain — needs state→domain lookup table. |
| Aggregators (KFF, MACPAC) | HTML | **Low-Medium** | Validation/QA baseline, not the live data path (lag, editorial framing). |

**Build planning bottom line:** Medicare = cleaner data model (one canonical DB, weekly feed, structured reports) but harder *access* (bot protection, confirmed live). Medicaid = easier access (plain PDFs/HTML) but harder *data engineering* (50 formats, no feed — compute deltas via snapshot diffing). Budget accordingly: browser-automation robustness for cms.gov, PDF-table extraction + snapshot/diff pipeline for the states.
