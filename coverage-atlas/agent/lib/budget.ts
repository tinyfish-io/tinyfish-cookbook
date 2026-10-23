// Hard ceilings on a scan, and the rule for when it is done.
//
// A scanner that walks fifty-one independent sources, follows leads out of the
// pages it reads, and keeps digging until every gap is closed will happily run
// forever on a condition whose sources are thin. Two ceilings bound it:
//
//   TinyFish calls — every search, fetch and browser run, counted together.
//     This is the external spend and the wall-clock cost.
//   Orchestrator steps — one discrete unit of the plan: a source read, a state
//     processed, a backfill round. This bounds the *shape* of the work, so a
//     cheap-but-endless loop cannot slip past the call cap.
//
// Whichever binds first stops the scan. The scan also stops early, and this is
// the good ending, when every jurisdiction has a timestamped policy with a
// citation — there is nothing left worth spending on.
//
// Running out is not a failure. Whatever is still missing when the budget closes
// gets filled from the model's own knowledge, marked `inferred`, and flagged for
// review — because a map with an honest low-confidence cell is more useful than
// a map with a hole in it, as long as it says which is which.

export type StopReason = "complete" | "call_cap" | "step_cap"

export type BudgetLimits = {
  maxTinyfishCalls: number
  maxSteps: number
  maxAgentRuns: number
}

export const DEFAULT_LIMITS: BudgetLimits = {
  maxTinyfishCalls: 200,
  maxSteps: 80,
  maxAgentRuns: 6,
}

export class Budget {
  tinyfishCalls = 0
  steps = 0
  agentRuns = 0
  private stopped: StopReason | null = null

  constructor(readonly limits: BudgetLimits = DEFAULT_LIMITS) {}

  /** True once either ceiling is reached. Checked before spending, never after. */
  get exhausted(): boolean {
    return this.tinyfishCalls >= this.limits.maxTinyfishCalls || this.steps >= this.limits.maxSteps
  }

  get stopReason(): StopReason {
    if (this.stopped) return this.stopped
    if (this.tinyfishCalls >= this.limits.maxTinyfishCalls) return "call_cap"
    if (this.steps >= this.limits.maxSteps) return "step_cap"
    return "complete"
  }

  /** Mark a clean finish: every jurisdiction answered before the ceilings bound. */
  markComplete(): void {
    if (!this.stopped) this.stopped = "complete"
  }

  /** Remaining TinyFish calls, so a phase can size its own fan-out to what is left. */
  get callsLeft(): number {
    return Math.max(0, this.limits.maxTinyfishCalls - this.tinyfishCalls)
  }

  get stepsLeft(): number {
    return Math.max(0, this.limits.maxSteps - this.steps)
  }

  /**
   * Reserve `n` TinyFish calls. Returns false when the reservation would breach
   * the ceiling, and the caller skips the work rather than partially spending —
   * a half-issued batch is harder to account for than one not issued.
   */
  spendCalls(n = 1): boolean {
    if (this.tinyfishCalls + n > this.limits.maxTinyfishCalls) return false
    this.tinyfishCalls += n
    return true
  }

  /** Browser runs are metered by TinyFish, so they carry their own smaller cap too. */
  spendAgentRun(): boolean {
    if (this.agentRuns >= this.limits.maxAgentRuns) return false
    if (!this.spendCalls(1)) return false
    this.agentRuns++
    return true
  }

  spendStep(n = 1): boolean {
    if (this.steps + n > this.limits.maxSteps) return false
    this.steps += n
    return true
  }

  snapshot() {
    return {
      tinyfishCalls: this.tinyfishCalls,
      maxTinyfishCalls: this.limits.maxTinyfishCalls,
      steps: this.steps,
      maxSteps: this.limits.maxSteps,
      stoppedBecause: this.stopReason,
    }
  }
}
