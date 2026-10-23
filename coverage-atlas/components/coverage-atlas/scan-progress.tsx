"use client"

import { Activity, ChevronRight, Loader2, Radio, Square, X, Zap } from "lucide-react"
import { useEffect, useRef } from "react"
import { phaseLabel, type ScanState } from "./use-atlas"

/**
 * One line, under the thing you were already looking at.
 *
 * While a scan runs the only question is "what is it doing right now, and how
 * far along is it". That fits on one line. Everything else — the phase log, the
 * budget, the ledger — belongs behind a button, because a console pinned to
 * every page is noise on the four pages that are not about scanning.
 */
export function ScanProgressLine({
  scan,
  onOpenLog,
  onCancel,
}: {
  scan: ScanState
  onOpenLog: () => void
  onCancel: () => void
}) {
  if (!scan.running && !scan.error) return null
  const pct = scan.total > 0 ? Math.round((scan.done / scan.total) * 100) : 0

  if (scan.error) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs">
        <Activity className="size-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1 text-destructive">{scan.error}</span>
        <button onClick={onOpenLog} className="shrink-0 rounded-md border px-2.5 py-1.5 font-medium hover:bg-muted">
          Open log
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Radio className="atlas-pulse size-4 shrink-0" style={{ color: "var(--scan-live)" }} aria-hidden />
        <span className="shrink-0 text-xs font-semibold">{phaseLabel(scan.currentPhase)}</span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {scan.currentTask ?? "starting…"}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {scan.done}/{scan.total}
        </span>
        <button
          onClick={onOpenLog}
          className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Full log
          <ChevronRight className="size-3" />
        </button>
        <button
          onClick={onCancel}
          className="shrink-0 rounded-md border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Stop scan"
        >
          <Square className="size-3" />
        </button>
      </div>
      <div className="h-1 bg-muted">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: "var(--scan-live)" }}
        />
      </div>
    </div>
  )
}

/**
 * The full run log, in a side panel.
 *
 * Everything the orchestrator emitted, plus the two numbers that explain the
 * shape of the run: how many jurisdictions the one shared read settled, and how
 * much of the call ceiling has been spent. Opened on demand, closed by default.
 */
export function ScanLogPanel({
  scan,
  open,
  onClose,
  onCancel,
}: {
  scan: ScanState
  open: boolean
  onClose: () => void
  onCancel: () => void
}) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [open, scan.phases.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const ledger = scan.ledger
  const saved = ledger ? ledger.naivePromptTokensEstimate - ledger.promptTokens : 0
  const ratio = ledger && ledger.promptTokens > 0 ? ledger.naivePromptTokensEstimate / ledger.promptTokens : 0
  // A ledger from before budgets existed has none; the panel renders history too.
  const budget = scan.budget ?? (ledger?.budget ? { ...ledger.budget } : null)
  const stopReason = ledger?.budget?.stoppedBecause

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-lg flex-col border-l bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Agent run log"
      >
        <header className="flex items-start justify-between border-b p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {scan.running ? (
                <Loader2 className="size-4 animate-spin" style={{ color: "var(--scan-live)" }} />
              ) : (
                <Activity className="size-4 text-muted-foreground" />
              )}
              {scan.running ? "Agent running" : scan.error ? "Run failed" : "Run complete"}
            </h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {scan.resolved ? `${scan.resolved.name} · ${scan.resolved.treatmentClass}` : (scan.condition ?? "")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {scan.running && (
              <button onClick={onCancel} className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                Stop
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close log">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-px border-b bg-border">
          <Tile label="Jurisdictions" value={`${scan.done}/${scan.total}`} />
          <Tile
            label="TinyFish calls"
            value={budget ? `${budget.tinyfishCalls}/${budget.maxTinyfishCalls}` : "—"}
            bar={budget ? budget.tinyfishCalls / budget.maxTinyfishCalls : undefined}
          />
          <Tile
            label="Orchestrator steps"
            value={budget ? `${budget.steps}/${budget.maxSteps}` : "—"}
            bar={budget ? budget.steps / budget.maxSteps : undefined}
          />
          <Tile
            label="Settled by one read"
            value={scan.plan ? `${scan.plan.fromBaseline}` : "—"}
            note={scan.plan ? `${scan.plan.toFanOut} to subagents` : undefined}
          />
        </div>

        <div
          ref={logRef}
          className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-3 font-mono text-[11px] leading-5"
          role="log"
          aria-live="polite"
        >
          {scan.phases.map((p, i) => (
            <div key={`${p.at}-${i}`} className="flex gap-2 py-px">
              <span className="w-16 shrink-0 text-muted-foreground">[{p.phase}]</span>
              <span className="min-w-0 flex-1 break-words">{p.note}</span>
            </div>
          ))}
          {scan.phases.length === 0 && <span className="text-muted-foreground">waiting for the first event…</span>}
        </div>

        {scan.error && <div className="border-t bg-destructive/5 px-4 py-3 text-xs text-destructive">{scan.error}</div>}

        {ledger && (
          <div className="border-t">
            <div className="grid grid-cols-3 gap-px bg-border">
              <Tile label="Run time" value={`${(ledger.durationMs / 1000).toFixed(1)}s`} />
              <Tile
                label="Model calls"
                value={`${ledger.llmCalls}`}
                note={`${ledger.promptTokens.toLocaleString()} prompt`}
              />
              <Tile
                label="Gaps closed"
                value={`${ledger.statesBackfilled ?? 0}`}
                note={(ledger.statesInferred ?? 0) > 0 ? `${ledger.statesInferred} inferred` : "none inferred"}
              />
            </div>
            <div className="flex items-start gap-2.5 px-4 py-3 text-xs">
              <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <p className="leading-5 text-muted-foreground">
                Stopped because{" "}
                <strong className="text-foreground">
                  {stopReason === "call_cap"
                    ? "the TinyFish call ceiling was reached"
                    : stopReason === "step_cap"
                      ? "the orchestrator step ceiling was reached"
                      : "every jurisdiction was answered"}
                </strong>
                .{" "}
                {ratio > 1 && (
                  <>
                    <strong className="text-foreground">{ratio.toFixed(1)}× cheaper</strong> than a whole-document-per-state
                    loop — about {saved.toLocaleString()} prompt tokens not spent.{" "}
                  </>
                )}
                {(ledger.historicalChanges ?? 0) > 0 &&
                  `${ledger.historicalChanges} change events came from dated versions found during this scan.`}
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Tile({ label, value, note, bar }: { label: string; value: string; note?: string; bar?: number }) {
  return (
    <div className="bg-background p-3">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {note && <div className="mt-0.5 text-[10px] text-muted-foreground">{note}</div>}
      {bar !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, bar * 100)}%`,
              background: bar > 0.85 ? "var(--policy-limited)" : "var(--scan-live)",
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Header button: opens the log, and shows live pressure while a scan runs. */
export function ScanLogButton({ scan, onClick }: { scan: ScanState; onClick: () => void }) {
  if (!scan.running && !scan.ledger && !scan.error) return null
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium hover:bg-muted"
      title="Open the full agent log"
    >
      {scan.running ? (
        <Radio className="atlas-pulse size-3.5" style={{ color: "var(--scan-live)" }} />
      ) : (
        <Activity className="size-3.5 text-muted-foreground" />
      )}
      Agent log
      {scan.running && <span className="tabular-nums text-muted-foreground">{scan.done}/{scan.total}</span>}
    </button>
  )
}
