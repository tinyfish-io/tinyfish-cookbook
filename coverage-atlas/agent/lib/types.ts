// Shared vocabulary for the whole system. The web app imports these too, so any
// change here is a change to the contract the UI renders.

/** What a jurisdiction actually does about a treatment. */
export type CoverageStatus =
  | "covered"      // on the formulary / benefit with no notable gate
  | "conditional"  // covered, but a prior-authorization or criteria gate stands in front
  | "limited"      // covered only for a narrow slice (sub-population, step therapy, hard caps)
  | "not_covered"  // explicitly excluded
  | "unpublished"  // no published fee-for-service policy we could find

export type AuthorizationGate = "none" | "prior_authorization" | "step_therapy"

export type Confidence = "high" | "moderate" | "review_needed"

/**
 * The friction ledger. This is the opinionated core of Coverage Atlas: coverage
 * status alone is close to meaningless, because two states that both say
 * "covered" can be forty points apart in how hard it is to actually get the
 * drug into a patient's hands. Each flag is a documented administrative gate,
 * carrying the weight it contributes to the Access Friction Index.
 */
export type FrictionFlag =
  | "prior_authorization"
  | "step_therapy"
  | "clinical_threshold"        // BMI >= 30, A1c >= 7, fibrosis stage, etc.
  | "prior_failure_required"    // must document a failed trial of something cheaper
  | "supervised_program"        // documented lifestyle/behavioural program participation
  | "specialist_prescriber"     // only endocrinology/rheumatology/etc. may prescribe
  | "quantity_limit"
  | "short_renewal"             // reauthorization more often than annually
  | "medical_benefit_only"      // no pharmacy-counter path; billed as DME/medical
  | "age_restriction"
  | "diagnosis_restriction"     // only covered for an adjacent indication

export const FRICTION_WEIGHTS: Record<FrictionFlag, number> = {
  prior_authorization: 22,
  step_therapy: 18,
  prior_failure_required: 14,
  supervised_program: 12,
  clinical_threshold: 10,
  specialist_prescriber: 9,
  short_renewal: 8,
  quantity_limit: 7,
  medical_benefit_only: 6,
  diagnosis_restriction: 6,
  age_restriction: 5,
}

export const FRICTION_LABELS: Record<FrictionFlag, string> = {
  prior_authorization: "Prior authorization",
  step_therapy: "Step therapy",
  prior_failure_required: "Documented prior failure",
  supervised_program: "Supervised program participation",
  clinical_threshold: "Clinical threshold",
  specialist_prescriber: "Specialist prescriber only",
  short_renewal: "Renewal under 12 months",
  quantity_limit: "Quantity limit",
  medical_benefit_only: "Medical benefit only",
  diagnosis_restriction: "Restricted diagnosis",
  age_restriction: "Age restriction",
}

/**
 * One dated observation of a jurisdiction's policy.
 *
 * A state's policy has a history, and that history is usually visible in the
 * documents themselves: a bulletin announcing a change states what the rule was
 * before it, and a superseded preferred drug list carries its own effective
 * date. A scanner that only records "what is true now" throws that away and has
 * to wait for its own second scan before it can say anything about change at
 * all. Recording dated versions means a single scan already carries the delta.
 */
export type PolicyVersion = {
  status: CoverageStatus
  authorization: AuthorizationGate
  frictionFlags: FrictionFlag[]
  frictionIndex: number
  criteriaSummary: string | null
  criteriaVerbatim: string | null
  /** When this version of the policy took effect, per the source. */
  effectiveDate: string | null
  /** When the document stating it was published or last revised. */
  documentDate: string | null
  sourceDoc: string | null
  sourceUrl: string | null
  /** True for the version the scanner believes is in force today. */
  isCurrent: boolean
  discoveredAt: string
}

/** One jurisdiction's policy for one condition, as of one scan. */
export type CoverageRecord = {
  state: string                  // 2-letter USPS, plus DC
  stateName: string
  fips: string                   // for the choropleth
  program: "medicaid_ffs"
  status: CoverageStatus
  authorization: AuthorizationGate
  frictionFlags: FrictionFlag[]
  /** 0-100. Higher = harder to actually obtain. Derived, never extracted. */
  frictionIndex: number
  /** 100 - frictionIndex, floored at 0 for states with no pathway at all. */
  accessScore: number
  criteriaSummary: string | null
  /** Verbatim policy language. Never paraphrased away — the compare view leans on it. */
  criteriaVerbatim: string | null
  administeringEntity: string | null
  sourceDoc: string | null
  sourceUrl: string | null
  effectiveDate: string | null   // ISO date
  confidence: Confidence
  /**
   * How this record was obtained — the escalation ladder rung that produced it.
   * `inferred` is the only value not backed by a source document: it marks a
   * record filled in from the model's own knowledge after the call budget was
   * exhausted, and it always carries `review_needed` confidence.
   */
  method: "baseline" | "search" | "fetch" | "agent" | "backfill" | "carried_forward" | "inferred"
  lastCheckedAt: string          // ISO timestamp
  /** When the source document itself was published or last revised. */
  documentDate: string | null
  /**
   * Dated versions of this state's policy, oldest first, including the current
   * one. Populated whenever a source states what the rule was before or after
   * the version in force — the raw material for change events from a single scan.
   */
  history: PolicyVersion[]
  /** sha256 of the evidence window. Equal hash across scans => zero LLM tokens spent. */
  evidenceHash: string | null
  notes: string | null
}

/** What a record is still missing. Drives the backfill pass and the stop condition. */
export type RecordGap = "no_policy_found" | "no_source" | "no_timestamp" | "no_criteria" | "no_history"

export type ChangeDirection =
  | "coverage_added"
  | "coverage_dropped"
  | "loosened"        // friction fell
  | "tightened"       // friction rose
  | "clarified"       // wording moved, substance did not
  | "stable"

export type ChangeEvent = {
  id: string
  state: string
  stateName: string
  direction: ChangeDirection
  headline: string
  detail: string | null
  fromStatus: CoverageStatus | null
  toStatus: CoverageStatus | null
  frictionDelta: number          // signed; negative = easier to get
  announcedOn: string | null     // ISO date
  effectiveOn: string | null
  sourceDoc: string | null
  sourceUrl: string | null
  /**
   * How we know this happened, in descending order of directness:
   *   observed   — our own snapshot differ caught it between two scans
   *   historical — we read two dated versions of the state's own policy and compared them
   *   reported   — a dated public announcement said so
   */
  provenance: "observed" | "historical" | "reported"
  detectedAt: string
}

/** A user-defined condition. Free text in, canonical scan target out. */
export type ConditionSpec = {
  slug: string
  /** Exactly what the user typed. Kept so the UI can show their own words back. */
  userInput: string
  name: string                   // canonical condition, e.g. "Obesity"
  treatmentClass: string         // e.g. "GLP-1 receptor agonists"
  treatments: string[]           // brand/generic names the scanner searches for
  /** Why states are allowed to differ at all — the policy lever. Drives the narrative. */
  policyLever: string
  searchTerms: string[]
  createdAt: string
  builtIn: boolean
}

/** One full 51-jurisdiction observation, immutable once written. */
export type Snapshot = {
  conditionSlug: string
  scannedAt: string              // ISO timestamp; also the file name key
  records: CoverageRecord[]
  sources: DiscoveredSource[]
  ledger: RunLedger
}

export type DiscoveredSource = {
  url: string
  title: string
  siteName: string | null
  kind: "national_tracker" | "state_policy" | "news" | "federal"
  statesAddressed: number
  usedFor: string
}

/** The cost story. Printed at the end of every run and shown in the UI. */
export type RunLedger = {
  runId: string
  conditionSlug: string
  startedAt: string
  finishedAt: string | null
  durationMs: number
  tinyfishSearches: number
  tinyfishFetches: number
  tinyfishAgentRuns: number
  llmCalls: number
  promptTokens: number
  completionTokens: number
  /** States settled by the shared baseline, needing no per-state LLM call at all. */
  statesFromBaseline: number
  /** States whose evidence hash was unchanged since the last scan — free. */
  statesShortCircuited: number
  statesEscalated: number
  /** Prompt tokens we would have spent with a naive per-state full-document loop. */
  naivePromptTokensEstimate: number
  /** States whose gaps a targeted backfill round closed. */
  statesBackfilled: number
  /** States the model filled in from its own knowledge after the budget ran out. */
  statesInferred: number
  /** Change events derived from dated versions found within this single scan. */
  historicalChanges: number
  budget: {
    tinyfishCalls: number
    maxTinyfishCalls: number
    steps: number
    maxSteps: number
    /** Why the scan stopped. */
    stoppedBecause: "complete" | "call_cap" | "step_cap"
  }
  errors: string[]
}

export const STATES: [fips: string, name: string, code: string][] = [
  ["01", "Alabama", "AL"], ["02", "Alaska", "AK"], ["04", "Arizona", "AZ"], ["05", "Arkansas", "AR"],
  ["06", "California", "CA"], ["08", "Colorado", "CO"], ["09", "Connecticut", "CT"], ["10", "Delaware", "DE"],
  ["11", "District of Columbia", "DC"], ["12", "Florida", "FL"], ["13", "Georgia", "GA"], ["15", "Hawaii", "HI"],
  ["16", "Idaho", "ID"], ["17", "Illinois", "IL"], ["18", "Indiana", "IN"], ["19", "Iowa", "IA"],
  ["20", "Kansas", "KS"], ["21", "Kentucky", "KY"], ["22", "Louisiana", "LA"], ["23", "Maine", "ME"],
  ["24", "Maryland", "MD"], ["25", "Massachusetts", "MA"], ["26", "Michigan", "MI"], ["27", "Minnesota", "MN"],
  ["28", "Mississippi", "MS"], ["29", "Missouri", "MO"], ["30", "Montana", "MT"], ["31", "Nebraska", "NE"],
  ["32", "Nevada", "NV"], ["33", "New Hampshire", "NH"], ["34", "New Jersey", "NJ"], ["35", "New Mexico", "NM"],
  ["36", "New York", "NY"], ["37", "North Carolina", "NC"], ["38", "North Dakota", "ND"], ["39", "Ohio", "OH"],
  ["40", "Oklahoma", "OK"], ["41", "Oregon", "OR"], ["42", "Pennsylvania", "PA"], ["44", "Rhode Island", "RI"],
  ["45", "South Carolina", "SC"], ["46", "South Dakota", "SD"], ["47", "Tennessee", "TN"], ["48", "Texas", "TX"],
  ["49", "Utah", "UT"], ["50", "Vermont", "VT"], ["51", "Virginia", "VA"], ["53", "Washington", "WA"],
  ["54", "West Virginia", "WV"], ["55", "Wisconsin", "WI"], ["56", "Wyoming", "WY"],
]

export const STATE_NAMES: Record<string, string> = Object.fromEntries(STATES.map(([, n, c]) => [c, n]))
export const STATE_FIPS: Record<string, string> = Object.fromEntries(STATES.map(([f, , c]) => [c, f]))

/** Census divisions — the peer groups the outlier detector compares within. */
export const PEER_GROUPS: Record<string, string[]> = {
  "New England": ["CT", "ME", "MA", "NH", "RI", "VT"],
  "Middle Atlantic": ["NJ", "NY", "PA"],
  "East North Central": ["IL", "IN", "MI", "OH", "WI"],
  "West North Central": ["IA", "KS", "MN", "MO", "NE", "ND", "SD"],
  "South Atlantic": ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV"],
  "East South Central": ["AL", "KY", "MS", "TN"],
  "West South Central": ["AR", "LA", "OK", "TX"],
  Mountain: ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"],
  Pacific: ["AK", "CA", "HI", "OR", "WA"],
}

export const PEER_OF: Record<string, string> = Object.fromEntries(
  Object.entries(PEER_GROUPS).flatMap(([region, codes]) => codes.map((c) => [c, region] as const)),
)
