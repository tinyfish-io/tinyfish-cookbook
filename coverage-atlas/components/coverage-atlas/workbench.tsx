"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Activity,
  Bookmark,
  GitCompareArrows,
  Loader2,
  Map as MapIcon,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Table2,
  Trash2,
  X,
} from "lucide-react"
import {
  STATUS_LABEL,
  formatDate,
  relativeTime,
  summarize,
  type ConditionSummary,
  type CoverageRecord,
} from "@/lib/atlas"
import { PolicyMap, type MapMode } from "./policy-map"
import { PolicyDrawer } from "./policy-drawer"
import { ScanLogButton, ScanLogPanel, ScanProgressLine } from "./scan-progress"
import { Changes, Compare, InsightRail, Matrix, StateDirectory, Timeline } from "./views"
import { useAtlas, useConditions, useDisplayRecords, useScan } from "./use-atlas"

type Workspace = "Atlas" | "Changes" | "Compare" | "States" | "Saved views"
type View = "Map" | "Matrix" | "Timeline"

const NAV: [Workspace, typeof MapIcon][] = [
  ["Atlas", MapIcon],
  ["Changes", Activity],
  ["Compare", GitCompareArrows],
  ["States", Table2],
  ["Saved views", Bookmark],
]

export function Workbench() {
  const { conditions, refresh: refreshConditions } = useConditions()
  const [slug, setSlug] = useState<string | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [changeDays, setChangeDays] = useState(90)
  const [workspace, setWorkspace] = useState<Workspace>("Atlas")
  const [view, setView] = useState<View>("Map")
  const [mapMode, setMapMode] = useState<MapMode>("status")
  const [selected, setSelected] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [depth, setDepth] = useState<"baseline" | "standard" | "deep">("standard")
  const [logOpen, setLogOpen] = useState(false)

  const { atlas, changes, loading, error, refresh } = useAtlas(slug, asOf, changeDays)
  const { scan, start, cancel, clear } = useScan(
    useCallback(() => {
      void refreshConditions()
      void refresh()
    }, [refreshConditions, refresh]),
  )
  const records = useDisplayRecords(atlas, scan)

  // Default to whichever condition was scanned most recently.
  useEffect(() => {
    if (slug || conditions.length === 0) return
    const freshest = [...conditions].sort((a, b) => (b.lastScannedAt ?? "").localeCompare(a.lastScannedAt ?? ""))[0]
    setSlug(freshest.slug)
  }, [conditions, slug])

  // A scan started from the landing page types free text; the scanner resolves it
  // to a canonical condition. The moment it does, the header follows — otherwise
  // the map fills in with states belonging to a condition the switcher above it
  // is not showing, which is the most confusing thing this interface could do.
  const resolvedSlug = scan.resolved?.slug ?? null
  useEffect(() => {
    if (!resolvedSlug || resolvedSlug === slug) return
    setSlug(resolvedSlug)
    setAsOf(null)
    setSelected(null)
    void refreshConditions()
  }, [resolvedSlug, slug, refreshConditions])

  const condition = conditions.find((c) => c.slug === slug) ?? null
  const selectedRecord = records.find((r) => r.state === selected) ?? null
  const stats = useMemo(() => summarize(records), [records])

  // The last few states to land during a live scan animate in.
  const landing = useMemo(() => {
    if (!scan.running) return undefined
    return new Set([...scan.live.keys()].slice(-5))
  }, [scan.running, scan.live])

  const togglePin = (code: string) =>
    setPinned((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code].slice(-5)))

  const runScan = (query: string) => {
    setWorkspace("Atlas")
    void start(query, depth)
  }

  return (
    <div className="min-h-screen min-w-[680px] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 w-56 border-r bg-sidebar">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          {/* The mark carries its own colour, so it sits on the surface rather
              than inside a tinted tile the way a monochrome glyph would. */}
          <Image src="/tinyfish-mark.svg" alt="" width={34} height={34} className="size-[34px] shrink-0" priority />
          <div className="min-w-0">
            <div className="font-semibold tracking-tight">Coverage Atlas</div>
            <div className="truncate text-[11px] text-muted-foreground">Medicaid policy intelligence</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3" aria-label="Primary navigation">
          {NAV.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setWorkspace(label)}
              className={`flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                workspace === label
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
              {label === "Changes" && (changes?.summary.total ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {changes?.summary.total}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute inset-x-3 bottom-4 flex flex-col gap-2.5">
          <div className="rounded-md border bg-background p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium">
              <Sparkles className="size-3.5 text-primary" />
              Live-scraped, not curated
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Every record carries the source it was read from. Verify against the state's official publication before
              acting.
            </p>
          </div>
          <a
            href="https://tinyfish.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-1 opacity-75 transition-opacity hover:opacity-100"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Built on</span>
            <Image src="/tinyfish-wordmark.svg" alt="TinyFish" width={70} height={16} className="h-[15px] w-auto" />
          </a>
        </div>
      </aside>

      <div className="pl-56">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <ConditionSwitcher
            conditions={conditions}
            active={slug}
            onSelect={(s) => {
              setSlug(s)
              setAsOf(null)
              setSelected(null)
            }}
            onScan={runScan}
            onDelete={async (s) => {
              await fetch(`/api/conditions?slug=${encodeURIComponent(s)}`, { method: "DELETE" })
              if (s === slug) setSlug(null)
              await refreshConditions()
            }}
            running={scan.running}
          />

          <div className="ml-auto flex items-center gap-2">
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value as typeof depth)}
              className="hidden rounded-md border bg-card px-2 py-2 text-xs outline-none focus:border-primary lg:block"
              aria-label="Scan depth"
              title="baseline: trackers only, seconds. standard: fan out to whatever the trackers left thin. deep: every state gets its own subagent."
            >
              <option value="baseline">Baseline scan</option>
              <option value="standard">Standard scan</option>
              <option value="deep">Deep scan</option>
            </select>
            <button
              onClick={() => condition && runScan(condition.slug)}
              disabled={!condition || scan.running}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {scan.running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              {scan.running ? "Scanning…" : "Run scan"}
            </button>
            <ScanLogButton scan={scan} onClick={() => setLogOpen(true)} />
            {!scan.running && !scan.ledger && (
              <div className="hidden items-center gap-2 text-xs text-muted-foreground 2xl:flex">
                <span className="size-2 rounded-full bg-[var(--policy-covered)]" />
                {condition?.lastScannedAt ? `Scanned ${relativeTime(condition.lastScannedAt)}` : "Never scanned"}
              </div>
            )}
          </div>
        </header>

        <main className="p-4 md:p-6">
          {!condition ? (
            <EmptyState
              onScan={runScan}
              running={scan.running}
              progress={<ScanProgressLine scan={scan} onOpenLog={() => setLogOpen(true)} onCancel={cancel} />}
            />
          ) : (
            <>
              <PageTitle
                title={
                  workspace === "Atlas"
                    ? "Coverage atlas"
                    : workspace === "Changes"
                      ? "Policy changes"
                      : workspace === "Compare"
                        ? "Compare geography"
                        : workspace === "States"
                          ? "State directory"
                          : "Saved views"
                }
                subtitle={subtitleFor(workspace, condition, changeDays, stats)}
              />

              <ScanProgressLine scan={scan} onOpenLog={() => setLogOpen(true)} onCancel={cancel} />

              {error && !scan.running && (
                <div className="mt-5 rounded-lg border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No snapshot for {condition.name} yet. Run a scan to collect all 51 jurisdictions.
                  </p>
                  <button
                    onClick={() => runScan(condition.slug)}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <Play className="size-3.5" />
                    Run scan
                  </button>
                </div>
              )}

              {records.length > 0 && (
                <>
                  {workspace === "Atlas" && (
                    <section className="mt-5 rounded-lg border bg-card">
                      <div className="grid border-b md:grid-cols-3">
                        <Facet label="Treatment class" value={condition.treatmentClass} />
                        <Facet label="Program" value="Medicaid fee-for-service" />
                        <label className="border-b p-3 last:border-b-0 md:border-b-0 md:border-l md:last:border-r-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            View date
                          </span>
                          <select
                            value={asOf ?? ""}
                            onChange={(e) => setAsOf(e.target.value || null)}
                            className="mt-1 w-full bg-transparent text-sm font-medium outline-none"
                          >
                            <option value="">Latest — {formatDate(atlas?.scannedAt ?? null)}</option>
                            {(atlas?.snapshots ?? [])
                              .slice()
                              .reverse()
                              .slice(1)
                              .map((s) => (
                                <option key={s} value={s}>
                                  {formatDate(s.slice(0, 10))}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                        <div className="flex rounded-md bg-muted p-1">
                          {(["Map", "Matrix", "Timeline"] as View[]).map((v) => (
                            <button
                              key={v}
                              onClick={() => setView(v)}
                              className={`rounded px-3 py-1.5 text-xs font-medium ${view === v ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Colour by:</span>
                          <div className="flex rounded-md border p-0.5">
                            {(["status", "friction"] as MapMode[]).map((m) => (
                              <button
                                key={m}
                                onClick={() => setMapMode(m)}
                                className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${mapMode === m ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <button className="rounded-md border p-2 text-foreground hover:bg-muted" aria-label="Share view">
                            <Share2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {pinned.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/25 px-4 py-2 text-xs">
                          <span className="font-medium">Pinned</span>
                          {pinned.map((code) => (
                            <button
                              key={code}
                              onClick={() => togglePin(code)}
                              className="flex items-center gap-1 rounded-full border bg-background px-2 py-1"
                            >
                              {code}
                              <X className="size-3" />
                            </button>
                          ))}
                          <span className="ml-auto text-muted-foreground">Up to 5 states</span>
                        </div>
                      )}

                      {view === "Map" ? (
                        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
                          <PolicyMap
                            records={records}
                            mode={mapMode}
                            selected={selected ?? undefined}
                            onSelect={(r) => setSelected(r.state)}
                            landing={landing}
                          />
                          <InsightRail atlas={atlas} records={records} onSelect={(r) => setSelected(r.state)} />
                        </div>
                      ) : view === "Matrix" ? (
                        <Matrix records={records} onSelect={(r) => setSelected(r.state)} />
                      ) : (
                        <Timeline changes={changes} onSelect={setSelected} />
                      )}
                    </section>
                  )}

                  {workspace === "Changes" && (
                    <Changes changes={changes} onSelect={setSelected} days={changeDays} setDays={setChangeDays} />
                  )}

                  {workspace === "Compare" && (
                    <Compare records={records} pinned={pinned} conditionName={condition.name} changes={changes} />
                  )}

                  {workspace === "States" && <StateDirectory records={records} onSelect={(r) => setSelected(r.state)} />}

                  {workspace === "Saved views" && (
                    <SavedViews
                      conditions={conditions}
                      onOpen={(s) => {
                        setSlug(s)
                        setWorkspace("Atlas")
                      }}
                      onScan={runScan}
                      running={scan.running}
                    />
                  )}
                </>
              )}

              {loading && records.length === 0 && !error && (
                <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border bg-card p-12 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading snapshot…
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <ScanLogPanel
        scan={scan}
        open={logOpen}
        onClose={() => {
          setLogOpen(false)
          if (!scan.running) clear()
        }}
        onCancel={cancel}
      />

      {selectedRecord && condition && (
        <PolicyDrawer
          record={selectedRecord}
          conditionSlug={condition.slug}
          conditionName={condition.name}
          pinned={pinned.includes(selectedRecord.state)}
          onPin={() => togglePin(selectedRecord.state)}
          onCompare={() => {
            togglePin(selectedRecord.state)
            setWorkspace("Compare")
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
          onVerified={() => void refresh()}
        />
      )}
    </div>
  )
}

function subtitleFor(
  workspace: Workspace,
  condition: ConditionSummary,
  days: number,
  stats: ReturnType<typeof summarize>,
): string {
  switch (workspace) {
    case "Changes":
      return `Material shifts in ${condition.name.toLowerCase()} coverage over the last ${days} days`
    case "Compare":
      return `Two states, criterion by criterion, with the verbatim policy language underneath`
    case "States":
      return `${condition.name} records, freshness and verification by jurisdiction`
    case "Saved views":
      return "Conditions you have scanned. Re-run any of them to refresh the atlas and compute new deltas."
    default:
      return stats.withPathway > 0
        ? `${stats.withPathway} of ${stats.total} jurisdictions have a pathway, ${stats.spread} friction points apart`
        : `${condition.treatmentClass} across all 50 states and DC`
  }
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function Facet({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-1 block truncate text-sm font-medium">{value}</span>
    </div>
  )
}

/**
 * The condition control. Conditions are not a fixed menu: anything a user can
 * name, the scanner can go and collect. Typing a new one and pressing scan sends
 * it through resolution, source discovery and a full 51-jurisdiction sweep, and
 * saves it so the next scan of it can diff against this one.
 */
function ConditionSwitcher({
  conditions,
  active,
  onSelect,
  onScan,
  onDelete,
  running,
}: {
  conditions: ConditionSummary[]
  active: string | null
  onSelect: (slug: string) => void
  onScan: (query: string) => void
  onDelete: (slug: string) => void
  running: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  if (adding) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (!q) return
          onScan(q)
          setQuery("")
          setAdding(false)
        }}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          placeholder="Any condition or treatment — “GLP-1s for weight loss”, “CGMs”, “ABA therapy for autism”"
          className="h-9 min-w-0 flex-1 rounded-md border bg-muted/40 px-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!query.trim() || running}
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Scan 51 jurisdictions
        </button>
        <button type="button" onClick={() => setAdding(false)} className="shrink-0 rounded-md p-2 hover:bg-muted" aria-label="Cancel">
          <X className="size-4" />
        </button>
      </form>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Condition</span>
      <select
        value={active ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="max-w-64 truncate rounded-md border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      >
        {conditions.length === 0 && <option value="">No conditions yet</option>}
        {conditions.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name} — {c.treatmentClass}
          </option>
        ))}
      </select>
      <button
        onClick={() => setAdding(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium hover:bg-muted"
      >
        <Plus className="size-3.5" />
        New condition
      </button>
      {active && conditions.find((c) => c.slug === active && !c.builtIn) && (
        <button
          onClick={() => onDelete(active)}
          className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Remove this saved condition"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function EmptyState({
  onScan,
  running,
  progress,
}: {
  onScan: (q: string) => void
  running: boolean
  progress?: React.ReactNode
}) {
  const [query, setQuery] = useState("")
  const suggestions = ["GLP-1 drugs for weight loss", "Continuous glucose monitors", "ABA therapy for autism", "Hepatitis C antivirals"]

  return (
    <div className="mx-auto mt-16 max-w-2xl text-center">
      <h1 className="text-balance text-3xl font-semibold tracking-tight">Name a condition. See all fifty states.</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Medicaid publishes no cross-state coverage database and no change feed. Coverage Atlas goes and reads the
        sources — fifty-one independent jurisdictions — and computes what nobody publishes: the contrast between
        states, and the delta over time.
      </p>
      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) onScan(query.trim())
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A condition, a drug, a device…"
          className="h-11 flex-1 rounded-md border bg-card px-4 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!query.trim() || running}
          className="rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Scan
        </button>
      </form>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onScan(s)}
            disabled={running}
            className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="text-left">{progress}</div>
    </div>
  )
}

function SavedViews({
  conditions,
  onOpen,
  onScan,
  running,
}: {
  conditions: ConditionSummary[]
  onOpen: (slug: string) => void
  onScan: (q: string) => void
  running: boolean
}) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {conditions.map((c) => (
        <article key={c.slug} className="rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{c.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.treatmentClass}</p>
            </div>
            <Bookmark className="size-4 shrink-0 text-primary" />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{c.policyLever}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{c.stateCount} jurisdictions</span>
            <span>{c.snapshots.length} snapshot{c.snapshots.length === 1 ? "" : "s"}</span>
            <span>{c.changeCount} change events</span>
            <span>Scanned {relativeTime(c.lastScannedAt)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onOpen(c.slug)} className="flex-1 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted">
              Open atlas
            </button>
            <button
              onClick={() => onScan(c.slug)}
              disabled={running}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Re-scan {c.snapshots.length > 0 ? "and diff" : ""}
            </button>
          </div>
        </article>
      ))}
      {conditions.length === 0 && (
        <p className="col-span-full rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing saved yet. Every condition you scan is saved here, and re-scanning one computes the delta against its
          previous snapshot.
        </p>
      )}
    </div>
  )
}
