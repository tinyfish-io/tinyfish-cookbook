# Commercial Landscape — Medicare/Medicaid Coverage Policy Tracking

> Research agent output, 2026-08-21. Existing products, buyers, presentation benchmarks, credibility requirements.

## 1. Existing Products

### Policy Reporter (Mercalis/Valeris, formerly TrialCard)
- Tracks: LCDs, NCDs, formulary status, medical policy, PA criteria, fee schedules, state legislation. Suite: PolicyCore, Payer Landscape Dashboard, Covered Lives Dashboard, Fee Schedule Lookup, Formulary Suite, **Policy Scout** (personalized payer alerts), **Code Watch** (per-billing-code coverage change monitoring), State Legislation Data, Provider Access Lookup, Payer Compliance Dashboard.
- Scale claimed: **4.1M+ policy changes tracked, 300M+ covered lives, 230K+ policy documents, 780K+ payer policies**.
- Cross-state comparison: dashboard/lookup-based — **no public map or visual state comparator**. Coverage Viewer—Pharmacy Edition notably combines PA criteria with pharmacy *and* medical covered-lives data (competitors silo these).
- Customers: pharma, diagnostics, device makers, payers, providers.
- [policyreporter.com](https://www.policyreporter.com/) · [Coverage Viewer launch](https://www.prnewswire.com/news-releases/trialcards-policy-reporter-announces-launch-of-its-coverage-viewer-pharmacy-edition-301228850.html)

### MMIT (Norstella)
- Tracks: formulary status, benefit channel (pharmacy vs medical), PA, step therapy, quantity limits, plan affiliations, policy changes. Products: Navigator, **CoverageFinder** (real-time plan-specific lookup, embeddable), API (NorstellaLinQ feed), Analytics, Reach, Contract Validation, Medical Drug Lists, Directory of Health Plans.
- CoverageFinder is one-drug-one-plan **lookup**, not a side-by-side matrix — a real functional gap.
- Ecosystem: Evaluate, Citeline, Panalgo, Dedham Group — integrated market-access stack.
- [CoverageFinder](https://www.mmitnetwork.com/coveragefinder/) · [Navigator](https://www.mmitnetwork.com/navigator/) · [API](https://www.mmitnetwork.com/api/) · [Directory](https://www.mmitnetwork.com/directory-of-health-plans/)

### AIS Health Data (now under MMIT)
- Health-plan **directory** (enrollment by company/state, NCQA status, PBM contracts, 4,000+ execs) — the market treats "who covers whom" and "what's covered" as separate product categories. Ours combines both.

### Turquoise Health
- Different axis: **price transparency** (negotiated rates from payer machine-readable files), not coverage/PA policy. Their published **Payer Transparency Score Methodology** is a good template for a defensible per-state data-quality/completeness score.
- [reports](https://turquoise.health/reports) · [methodology](https://blog.turquoise.health/payer-transparency-score-methodology/)

### State Medicaid PDL space — genuine white space
- 30+ states run PDLs; some statewide (PA's applies across FFS and all MCOs), others let individual MCOs run separate PDLs within one state. AJMC (2008, still most-cited): **62% of drug ingredients had ≥2 states disagreeing on coverage** — PDLs are demonstrably not evidence-harmonized. **No commercial multi-state PDL aggregator exists**; today it's state-by-state manual navigation.
- [AJMC — How Similar Are States' Medicaid PDLs?](https://www.ajmc.com/view/nov08-3706psp46-sp52) · [PA Statewide PDL](https://www.pa.gov/agencies/dhs/resources/pharmacy-services/preferred-drug-list)

### Medicare LCD/NCD — CMS's own tool is the baseline to beat
- **Medicare Coverage Database (MCD)** at `cms.gov/medicare-coverage-database/` — canonical LCD/NCD source. Has "Local Coverage Final LCDs by State Report" (select state + MAC jurisdiction → flat list). Purely tabular — **no cross-state matrix, no map, no change timeline, no diff view.** The exact gap a polished demo visibly fills.
- [LCD process](https://www.cms.gov/medicare/coverage/determination-process/local) · [state report](https://www.cms.gov/medicare-coverage-database/reports/local-coverage-final-lcds-state-report.aspx) · [search](https://www.cms.gov/medicare-coverage-database/search.aspx)

## 2. Who Buys, and Their Actual Questions

| Buyer | Why | Representative questions |
|---|---|---|
| Pharma market access | Track step-edit changes, rebate shifts, PA approval-rate drops by region; forecast payer response to launches | "Where are PA approval rates collapsing this quarter?" |
| Providers/health systems | Determine coverage for a specific therapy/population before ordering, to avoid denials | "Is CGM covered for type-2 non-insulin patients in this state?" — real variation: SC covers non-insulin with recurrent/severe hypoglycemia; TX requires severe hypoglycemia/unexplained swings/ketoacidosis; **8 states (AL, AZ, FL, GA, HI, KS, NJ, DC) have zero CGM coverage**; 4 cover children only |
| Payers/PBMs | Benchmark their PA/formulary posture vs peers | Implied by MMIT Reach/Analytics demand |
| Diagnostics/device makers | Coverage for tests/DME lives in *medical* benefit policy, separate from drug formularies | Policy Reporter lists them explicitly as a segment |

**GLP-1 is the sharpest live demo example (mid-2026):** federal rules force every state Medicaid program to cover a GLP-1 for T2 diabetes, high CV risk, or moderate/severe sleep apnea — but **obesity/weight-loss coverage is fully state-discretionary**. As of July 2026 only **11 states** cover GLP-1s for obesity (down from 13: Utah's pilot ended 2026-06-30, Massachusetts ended 2026-07-01). **~80% of adult Medicaid enrollees live in a state with no obesity GLP-1 pathway.** A state *removing* coverage mid-year is exactly the change-tracking story the demo should surface.
- [RX Index GLP-1 tracker](https://therxindex.com/research/medicaid-glp-1-coverage-by-state/) · [CHCS CGM state coverage](https://www.chcs.org/resource/continuous-glucose-monitor-access-for-medicaid-beneficiaries-living-with-diabetes-state-by-state-coverage/) · [T1D Exchange CGM guide](https://t1dexchange.org/a-guide-to-cgms-and-medicaid-coverage-differences-by-state/)

## 3. Presentation Patterns

1. **Choropleth with categorical legend** — KFF's [Medicaid Expansion map](https://www.kff.org/medicaid/status-of-state-medicaid-expansion-decisions/): states colored by status, asterisks for edge cases, PowerPoint download, **linked table view as escape hatch**. Map is one of three views, never the only one.
2. **Table/map/trend toggle** — KFF State Health Facts indicator pages: same indicator, three views, filter by timeframe/geography. **Strongest reusable idea.**
3. **State×criteria matrix** — implied nowhere fully realized; a 50-row × N-criteria grid (PA? step therapy? BMI threshold? dx-code restriction?) per condition **doesn't exist as a polished commercial product today**. Differentiation opportunity.
4. **Timeline of policy changes** — alerting exists internally at Policy Reporter, but no public timeline visualization found. "Added GLP-1 obesity coverage → rescinded (UT/MA 2026)" would look novel.
5. **Side-by-side state policy diffs** — **not found anywhere as a built product.** Likely the single best differentiator: literally diffing two states' PA criteria text.

## 4. KFF Specifics

- **Medicaid Benefits 50-state survey** (`kff.org/data-collections/medicaid-benefits/`): inpatient/outpatient, FQHCs, physician, dental, **prescription drugs**, PT/OT, DME, home health, hospice, transportation, etc. Surveyed via HMA, FFS coverage for categorically-needy adults 21+. **Caveat: last comprehensive round is July 1, 2018 — stale.** Cite as presentation benchmark, not current data; lean on live trackers (HCBS survey, Eligibility & Enrollment survey, GLP-1/CGM condition trackers) for currency.
- URL patterns: `kff.org/{topic}/state-indicator/{slug}/`, interactive maps at `kff.org/{topic}/{topic-slug}/`, per-state fact sheets at `kff.org/interactive/medicaid-state-fact-sheets/`.

## 5. Credibility Details Clinicians/Payers Expect

- **Explicit effective date** on every policy shown; absence is a red flag.
- **Direct link to the source policy PDF**, not a paraphrase (Denver Health quarterly PA-criteria PDFs are the format model).
- **PA criteria verbatim, not summarized** — SC's "recurrent moderate or ≥1 severe hypoglycemic event" vs TX's "frequent severe hypoglycemia, unexplained fluctuations, ketoacidosis, or hospitalization" are materially different clinical bars; paraphrase blurs load-bearing distinctions.
- **Governance attribution** — which committee/body owns the policy ("reviewed by the Utilization Management Committee").
- **"Last verified" timestamp separate from effective date** — no commercial tool publishes this distinctly. "Effective 07/01/2026, last verified by our scanner 08/20/2026" signals rigor competitors don't show.
- **AMA explicitly flags PA-criteria opacity as a named industry pain point** — verbatim criteria with sourcing addresses it directly.
- [Denver Health PA criteria PDF](https://www.denverhealthmedicalplan.org/sites/default/files/resources/document/MCD_CHP_Prior_Authorization_criteria_3Q2026_508_7-10-26.pdf) · [Superior HealthPlan effective-date notices](https://www.superiorhealthplan.com/newsroom/eff-07312026-clinical-policies-07222026.html) · [AMA on prior-auth transparency](https://www.ama-assn.org/practice-management/prior-authorization/fixing-prior-auth-clear-what-s-required-and-when)

## Bottom Line

The market has two disconnected halves: enterprise platforms (Policy Reporter, MMIT) — deep, real-time, but B2B lookup tools with no public map/diff view — and public trackers (KFF, CHCS, T1D Exchange) — strong map/table presentation but infrequent updates, single conditions. **No product combines: (a) 50-state choropleth + matrix + timeline, (b) verbatim PA criteria with source-PDF citation and effective/verified dates, (c) genuine state-to-state policy diff.** That combination is the differentiation story. Use the GLP-1 obesity story (11 states, two dropping coverage mid-2026) as the live "what changed" narrative — real, current, dramatic.
