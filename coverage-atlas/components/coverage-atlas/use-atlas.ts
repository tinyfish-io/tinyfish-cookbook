"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AtlasPayload, ChangesPayload, ConditionSpec, ConditionSummary, CoverageRecord } from "@/lib/atlas"

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function useConditions() {
  const [conditions, setConditions] = useState<ConditionSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getJson<{ conditions: ConditionSummary[] }>("/api/conditions")
      setConditions(data.conditions)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { conditions, loading, refresh }
}

export type AtlasState = {
  atlas: AtlasPayload | null
  changes: ChangesPayload | null
  loading: boolean
  error: string | null
}

export function useAtlas(slug: string | null, asOf: string | null, changeDays: number) {
  const [state, setState] = useState<AtlasState>({ atlas: null, changes: null, loading: false, error: null })

  const refresh = useCallback(async () => {
    if (!slug) return setState({ atlas: null, changes: null, loading: false, error: null })
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const query = asOf ? `&asOf=${encodeURIComponent(asOf)}` : ""
      const [atlas, changes] = await Promise.all([
        getJson<AtlasPayload>(`/api/atlas?condition=${encodeURIComponent(slug)}${query}`),
        getJson<ChangesPayload>(`/api/changes?condition=${encodeURIComponent(slug)}&days=${changeDays}`),
      ])
      setState({ atlas, changes, loading: false, error: null })
    } catch (err) {
      setState({ atlas: null, changes: null, loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  }, [slug, asOf, changeDays])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}

export type ScanPhase = { phase: string; note: string; at: number }

export type ScanState = {
  running: boolean
  condition: string | null
  /** The condition the scanner resolved the query to — drives the header sync. */
  resolved: ConditionSpec | null
  phases: ScanPhase[]
  /** The one line worth reading right now: what the agent is doing this second. */
  currentTask: string | null
  currentPhase: string | null
  /** Records as they land, so the map repaints jurisdiction by jurisdiction. */
  live: Map<string, CoverageRecord>
  done: number
  total: number
  plan: { fromBaseline: number; toFanOut: number } | null
  budget: { tinyfishCalls: number; maxTinyfishCalls: number; steps: number; maxSteps: number } | null
  ledger: AtlasPayload["ledger"] | null
  outliers: AtlasPayload["outliers"]
  error: string | null
}

/** Human phrasing for each phase, used by the one-line progress indicator. */
const PHASE_VERB: Record<string, string> = {
  resolve: "Working out what to scan",
  discover: "Finding policy sources",
  baseline: "Reading multi-state trackers",
  plan: "Planning the sweep",
  fanout: "Reading state policy documents",
  backfill: "Chasing down missing information",
  infer: "Filling what could not be sourced",
  changes: "Working out what changed",
}

export function phaseLabel(phase: string | null): string {
  if (!phase) return "Starting up"
  return PHASE_VERB[phase] ?? phase
}

const EMPTY_SCAN: ScanState = {
  running: false,
  condition: null,
  resolved: null,
  phases: [],
  currentTask: null,
  currentPhase: null,
  live: new Map(),
  done: 0,
  total: 51,
  plan: null,
  budget: null,
  ledger: null,
  outliers: [],
  error: null,
}

/**
 * Drives POST /api/scan and folds its SSE events into render state.
 *
 * Parsing is line-buffered because a chunk boundary lands mid-JSON often enough
 * that "split on \n\n and hope" drops roughly one state per scan — and a state
 * silently missing from the map is the exact failure this product cannot have.
 */
export function useScan(onFinished: () => void) {
  const [scan, setScan] = useState<ScanState>(EMPTY_SCAN)
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(
    async (condition: string, depth: "baseline" | "standard" | "deep") => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setScan({ ...EMPTY_SCAN, running: true, condition, live: new Map(), currentTask: `Interpreting "${condition}"` })

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condition, depth }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => ({}))
          throw new Error(detail.error ?? `scan failed (HTTP ${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data:")) continue
            let event: Record<string, unknown>
            try {
              event = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }
            setScan((prev) => reduce(prev, event))
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setScan((prev) => ({ ...prev, running: false, error: err instanceof Error ? err.message : String(err) }))
      } finally {
        if (!controller.signal.aborted) {
          setScan((prev) => ({ ...prev, running: false }))
          onFinished()
        }
      }
    },
    [onFinished],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setScan((prev) => ({ ...prev, running: false }))
  }, [])

  const clear = useCallback(() => setScan(EMPTY_SCAN), [])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { scan, start, cancel, clear }
}

function reduce(prev: ScanState, event: Record<string, unknown>): ScanState {
  switch (event.type) {
    case "phase":
      return {
        ...prev,
        currentPhase: String(event.phase),
        currentTask: String(event.note),
        // The full log is kept for the side panel; only the tail is retained,
        // because a deep scan emits hundreds of lines and none of the early ones
        // matter once the map has moved on.
        phases: [...prev.phases.slice(-400), { phase: String(event.phase), note: String(event.note), at: Date.now() }],
      }
    case "condition":
      return { ...prev, resolved: event.spec as ConditionSpec }
    case "budget":
      return {
        ...prev,
        budget: {
          tinyfishCalls: Number(event.tinyfishCalls),
          maxTinyfishCalls: Number(event.maxTinyfishCalls),
          steps: Number(event.steps),
          maxSteps: Number(event.maxSteps),
        },
      }
    case "plan":
      return {
        ...prev,
        total: Number(event.total),
        plan: { fromBaseline: Number(event.fromBaseline), toFanOut: Number(event.toFanOut) },
      }
    case "state": {
      const record = event.record as CoverageRecord
      const live = new Map(prev.live)
      live.set(record.state, record)
      return {
        ...prev,
        live,
        done: Number(event.done),
        total: Number(event.total),
        currentTask: `${record.stateName} — ${record.status.replace(/_/g, " ")}`,
      }
    }
    case "changes": {
      const note =
        `${event.observed} observed by snapshot diff, ${event.historical} from dated versions found in this scan, ` +
        `${event.reported} reported publicly`
      return { ...prev, currentTask: note, phases: [...prev.phases, { phase: "changes", note, at: Date.now() }] }
    }
    case "complete":
      return {
        ...prev,
        running: false,
        currentTask: null,
        ledger: event.ledger as ScanState["ledger"],
        outliers: (event.outliers ?? []) as ScanState["outliers"],
      }
    case "error":
      return { ...prev, running: false, currentTask: null, error: String(event.message) }
    default:
      return prev
  }
}

/** Live scan results take precedence over the stored snapshot while a scan runs. */
export function useDisplayRecords(atlas: AtlasPayload | null, scan: ScanState): CoverageRecord[] {
  return useMemo(() => {
    const stored = atlas?.records ?? []
    if (scan.live.size === 0) return stored
    const merged = new Map(stored.map((r) => [r.state, r]))
    for (const [code, record] of scan.live) merged.set(code, record)
    return [...merged.values()].sort((a, b) => a.stateName.localeCompare(b.stateName))
  }, [atlas, scan.live])
}
