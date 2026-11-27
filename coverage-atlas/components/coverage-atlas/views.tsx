"use client"

import { useMemo, useState } from "react"
import { ArrowRight, CircleHelp, Search, TrendingDown, TrendingUp } from "lucide-react"
import {
  AUTH_LABEL,
  CONFIDENCE_LABEL,
  DIRECTION_LABEL,
  FRICTION_LABELS,
  PROVENANCE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  formatDate,
  frictionColor,
  frictionSpreadWithinStatus,
  isInferred,
  relativeTime,
  summarize,
  type AtlasPayload,
  type ChangeEvent,
  type ChangesPayload,
  type CoverageRecord,
} from "@/lib/atlas"
import { historyFor } from "@/agent/lib/derive"

/**
 * How we know a change happened. Three different strengths of claim, and the
 * badge says which — "we watched this" and "we read about this" should never
 * look alike.
 */
function ProvenanceBadge({ provenance }: { provenance: ChangeEvent["provenance"] }) {
  const tone =
    provenance === "observed"
      ? "bg-accent text-primary"
      : provenance === "historical"
        ? "bg-[var(--difference)] text-foreground"
        : "bg-muted text-muted-foreground"
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>{PROVENANCE_LABEL[provenance]}</span>
}

/* ------------------------------------------------------------------ matrix */

type SortKey = "state" | "status" | "friction" | "effective"

/**
 * The grid no commercial coverage product ships: fifty-one rows against the
 * criteria columns, sortable, with the friction ledger inline. Sorting by
 * friction is the default question a provider has — "where can I actually
 * prescribe this" — and it is not the same ordering as sorting by status.
 */
export function Matrix({ records, onSelect }: { records: CoverageRecord[]; onSelect: (r: CoverageRecord) => void }) {
  const [sort, setSort] = useState<SortKey>("friction")
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1
    return [...records].sort((a, b) => {
      switch (sort) {
        case "state":
          return dir * a.stateName.localeCompare(b.stateName)
        case "status":
          return dir * a.status.localeCompare(b.status)
        case "effective":
          return dir * (a.effectiveDate ?? "").localeCompare(b.effectiveDate ?? "")
        default:
          return dir * (a.frictionIndex - b.frictionIndex)
      }
    })
  }, [records, sort, asc])

  const head: [SortKey | null, string][] = [
    ["state", "State"],
    ["status", "Coverage"],
    [null, "Gate"],
    ["friction", "Friction"],
    [null, "Documented requirements"],
    ["effective", "Effective"],
    [null, "Confidence"],
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {head.map(([key, label]) => (
              <th key={label} className="px-4 py-3 font-medium">
                {key ? (
                  <button
                    onClick={() => (sort === key ? setAsc((a) => !a) : (setSort(key), setAsc(true)))}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {label}
                    {sort === key && <span aria-hidden>{asc ? "↑" : "↓"}</span>}
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.state} onClick={() => onSelect(r)} className="cursor-pointer border-t hover:bg-muted/40">
              <td className="px-4 py-3 font-semibold">
                {r.stateName}
                {isInferred(r) && (
                  <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    unverified
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-sm" style={{ background: STATUS_COLOR[r.status] }} />
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{AUTH_LABEL[r.authorization]}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${r.frictionIndex}%`, background: frictionColor(r.frictionIndex) }}
                    />
                  </span>
                  <span className="font-mono text-[11px] font-semibold">{r.frictionIndex}</span>
                </span>
              </td>
              <td className="max-w-72 px-4 py-3 text-muted-foreground">
                {r.frictionFlags.length ? r.frictionFlags.map((f) => FRICTION_LABELS[f]).join(" · ") : "None documented"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(r.effectiveDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">{CONFIDENCE_LABEL[r.confidence]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- timeline */

/**
 * The delta, on a time axis. Medicaid publishes no change feed anywhere in the
 * country, so every entry here was either computed by diffing two of our own
 * snapshots or read out of a dated public announcement — and the badge says
 * which, because those are very different claims.
 */
export function Timeline({ changes, onSelect }: { changes: ChangesPayload | null; onSelect: (state: string) => void }) {
  const events = changes?.events ?? []
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No policy movement recorded in this window. Run a scan again later — deltas appear once two snapshots exist to
        compare, or as soon as a dated announcement surfaces.
      </div>
    )
  }

  const dates = events.map((e) => new Date(e.announcedOn ?? e.detectedAt).getTime())
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  const span = Math.max(1, max - min)

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatDate(new Date(min).toISOString())} — {formatDate(new Date(max).toISOString())}
        </span>
        <span>
          {changes?.summary.observed ?? 0} observed by snapshot diff · {changes?.summary.reported ?? 0} publicly reported
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {events.slice(0, 24).map((e) => {
          const at = new Date(e.announcedOn ?? e.detectedAt).getTime()
          const left = 4 + ((at - min) / span) * 84
          const easing = e.frictionDelta < 0
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e.state)}
              className="grid grid-cols-[64px_1fr] items-center gap-3 text-left"
            >
              <span className="font-mono text-xs font-semibold">{e.state}</span>
              <span className="relative h-9 rounded bg-muted">
                <span
                  className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-2 ring-background"
                  style={{ left: `${left}%`, background: easing ? "var(--policy-covered)" : "var(--policy-limited)" }}
                />
                <span className="absolute inset-y-0 left-3 right-3 flex items-center gap-2 truncate text-[11px]">
                  <span className="truncate pl-6 text-foreground">{e.headline}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground">{formatDate(e.announcedOn)}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ insight rail */

export function InsightRail({
  atlas,
  records,
  onSelect,
}: {
  atlas: AtlasPayload | null
  records: CoverageRecord[]
  onSelect: (r: CoverageRecord) => void
}) {
  const stats = summarize(records)
  const conditional = frictionSpreadWithinStatus(records, "conditional")
  const covered = frictionSpreadWithinStatus(records, "covered")
  const sameLabel = (conditional?.spread ?? 0) >= (covered?.spread ?? 0) ? conditional : covered

  return (
    <aside className="border-t p-4 xl:border-l xl:border-t-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">What stands out</h2>
        <CircleHelp className="size-4 text-muted-foreground" aria-hidden />
      </div>

      {sameLabel && sameLabel.spread > 10 && (
        <div className="mb-3 rounded-md border border-primary/30 bg-accent p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Same label, different burden</div>
          <p className="mt-1.5 text-xs leading-5">
            {sameLabel.count} states report the same coverage status, and they are{" "}
            <strong>{sameLabel.spread} friction points</strong> apart. {sameLabel.easiest.stateName} scores{" "}
            {sameLabel.easiest.frictionIndex}; {sameLabel.hardest.stateName} scores {sameLabel.hardest.frictionIndex}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(atlas?.outliers ?? []).map((o) => {
          const record = records.find((r) => r.state === o.state)
          return (
            <button
              key={`${o.kind}-${o.state}`}
              onClick={() => record && onSelect(record)}
              className="rounded-md border p-3 text-left hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{o.stateName}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {o.kind.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium">{o.headline}</div>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{o.detail}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-5 border-t pt-4 text-[11px] leading-4 text-muted-foreground">
        {stats.total} jurisdictions scanned · {stats.withPathway} with a pathway · {stats.gated} gated by prior auth or
        step therapy · {stats.needsReview} need review
      </div>
      {atlas?.sources?.length ? (
        <div className="mt-3 border-t pt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</div>
          <ul className="flex flex-col gap-1.5">
            {atlas.sources.slice(0, 4).map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] leading-4 text-muted-foreground hover:text-primary hover:underline"
                >
                  {s.siteName ?? s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}

/* ----------------------------------------------------------------- changes */

export function Changes({
  changes,
  onSelect,
  days,
  setDays,
}: {
  changes: ChangesPayload | null
  onSelect: (state: string) => void
  days: number
  setDays: (d: number) => void
}) {
  const summary = changes?.summary
  const events = changes?.events ?? []

  return (
    <>
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
        {[
          [summary?.total ?? 0, "Material changes"],
          [summary?.widened ?? 0, "Access widened"],
          [summary?.tightened ?? 0, "Access tightened"],
          [(summary?.observed ?? 0) + (summary?.historical ?? 0), "Caught by our own reading"],
        ].map(([n, l]) => (
          <div key={String(l)} className="border-b p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
            <div className="text-xl font-semibold">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex gap-2">
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-2 text-xs font-medium ${d === days ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
              >
                Last {d} days
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Sorted by how much access moved, not by date</span>
        </div>

        {events.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nothing recorded in this window.
          </p>
        ) : (
          <div className="divide-y">
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.state)}
                className="grid w-full items-start gap-3 p-4 text-left hover:bg-muted/40 md:grid-cols-[180px_1fr_140px]"
              >
                <div>
                  <span className="font-semibold">{e.stateName}</span>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {e.frictionDelta < 0 ? (
                      <TrendingDown className="size-3.5" style={{ color: "var(--policy-covered)" }} />
                    ) : (
                      <TrendingUp className="size-3.5" style={{ color: "var(--policy-limited)" }} />
                    )}
                    {DIRECTION_LABEL[e.direction]}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{e.headline}</div>
                  {e.detail && <div className="mt-1 text-xs leading-5 text-muted-foreground">{e.detail}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <ProvenanceBadge provenance={e.provenance} />
                    <span>Announced {formatDate(e.announcedOn)}</span>
                    {e.effectiveOn && <span>· effective {formatDate(e.effectiveOn)}</span>}
                  </div>
                </div>
                <span className="self-center text-xs font-medium text-primary">
                  View evidence <ArrowRight className="inline size-3" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ----------------------------------------------------------------- compare */

/**
 * State vs state, criterion by criterion, with the verbatim policy language
 * underneath every row. Differences are highlighted rather than described,
 * because the point of this view is that the difference is the finding.
 */
export function Compare({
  records,
  pinned,
  conditionName,
  changes,
}: {
  records: CoverageRecord[]
  pinned: string[]
  conditionName: string
  changes: ChangesPayload | null
}) {
  const fallback = records.slice(0, 2).map((r) => r.state)
  const [a, setA] = useState(pinned[0] ?? fallback[0] ?? "")
  const [b, setB] = useState(pinned[1] ?? fallback[1] ?? "")
  const left = records.find((r) => r.state === a)
  const right = records.find((r) => r.state === b)

  if (!left || !right) {
    return <p className="mt-5 rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Scan a condition first.</p>
  }

  const rows: [string, string, string, boolean][] = [
    ["Coverage", STATUS_LABEL[left.status], STATUS_LABEL[right.status], left.status !== right.status],
    ["Gate", AUTH_LABEL[left.authorization], AUTH_LABEL[right.authorization], left.authorization !== right.authorization],
    [
      "Access friction",
      `${left.frictionIndex}/100`,
      `${right.frictionIndex}/100`,
      Math.abs(left.frictionIndex - right.frictionIndex) >= 6,
    ],
    [
      "Documented requirements",
      left.frictionFlags.map((f) => FRICTION_LABELS[f]).join(", ") || "None documented",
      right.frictionFlags.map((f) => FRICTION_LABELS[f]).join(", ") || "None documented",
      left.frictionFlags.join() !== right.frictionFlags.join(),
    ],
    ["Effective date", formatDate(left.effectiveDate), formatDate(right.effectiveDate), false],
    ["Confidence", CONFIDENCE_LABEL[left.confidence], CONFIDENCE_LABEL[right.confidence], false],
    ["Last verified", relativeTime(left.lastCheckedAt), relativeTime(right.lastCheckedAt), false],
  ]

  const gap = Math.abs(left.frictionIndex - right.frictionIndex)
  const harder = left.frictionIndex > right.frictionIndex ? left : right
  const easier = harder === left ? right : left
  const sameLabel = left.status === right.status

  return (
    <>
      <section className="mt-5 rounded-lg border bg-card">
        <div className="flex flex-wrap items-end gap-4 border-b p-4">
          <Picker label="State 1" value={a} excluded={b} records={records} onChange={setA} />
          <div className="pb-2 text-xs font-semibold text-muted-foreground">VERSUS</div>
          <Picker label="State 2" value={b} excluded={a} records={records} onChange={setB} />
          <div className="ml-auto pb-2 text-xs text-muted-foreground">
            Condition: <strong className="text-foreground">{conditionName}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-4 text-xs font-medium text-muted-foreground">Policy fingerprint</th>
                {[left, right].map((r) => (
                  <th key={r.state} className="p-4">
                    <span className="mr-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">{r.state}</span>
                    {r.stateName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, l, r, differs]) => (
                <tr key={label} className="border-b last:border-0">
                  <td className="p-4 align-top text-xs font-medium text-muted-foreground">{label}</td>
                  <td className={`p-4 align-top text-xs ${differs ? "bg-[var(--difference)] font-semibold" : ""}`}>{l}</td>
                  <td className={`p-4 align-top text-xs ${differs ? "bg-[var(--difference)] font-semibold" : ""}`}>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Verbatim criteria, side by side</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The exact policy wording. A summary that says both states "require prior authorization" hides the part that
            decides whether a given patient qualifies.
          </p>
        </div>
        <div className="grid md:grid-cols-2">
          {[left, right].map((r, i) => (
            <article key={r.state} className={`p-4 ${i === 0 ? "border-b md:border-b-0 md:border-r" : ""}`}>
              <h3 className="text-sm font-semibold">{r.stateName}</h3>
              {r.criteriaVerbatim ? (
                <blockquote className="mt-3 rounded-md border-l-2 border-primary bg-muted/40 p-3 text-xs italic leading-5">
                  “{r.criteriaVerbatim}”
                </blockquote>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {r.criteriaSummary ?? "No criteria language captured for this jurisdiction in the latest scan."}
                </p>
              )}
              <div className="mt-3 text-[11px] text-muted-foreground">
                {r.sourceUrl ? (
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                    {r.sourceDoc ?? r.sourceUrl}
                  </a>
                ) : (
                  "No source document captured"
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">What actually separates them</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {sameLabel ? (
            <>
              Both states carry the same coverage label — {STATUS_LABEL[left.status].toLowerCase()} — and are{" "}
              <strong className="text-foreground">{gap} friction points</strong> apart.{" "}
              {gap >= 10
                ? `${harder.stateName} stacks ${harder.frictionFlags.length} documented gate${harder.frictionFlags.length === 1 ? "" : "s"} where ${easier.stateName} has ${easier.frictionFlags.length}. The label is identical; the prescription is not.`
                : `The administrative burden is genuinely comparable, which is rarer than the label alone would suggest.`}
            </>
          ) : (
            <>
              {left.stateName} is {STATUS_LABEL[left.status].toLowerCase()}; {right.stateName} is{" "}
              {STATUS_LABEL[right.status].toLowerCase()}. Beyond the label, the gap in what a prescriber has to
              document is {gap} friction points, with {harder.stateName} the harder of the two.
            </>
          )}
        </p>
      </div>

      <StateChangeDetail left={left} right={right} changes={changes} />
    </>
  )
}

/**
 * How each of the two states got here.
 *
 * The table above answers "how do they differ today". This answers "how did they
 * get that way", which is often the more useful half — a state that has held the
 * same rule for three years and a state that tightened it last quarter present
 * identically in a snapshot and could not be more different to plan around.
 *
 * Two tracks per state: the dated policy versions we read out of its own
 * documents, and the change events attributed to it from any source. Verbatim
 * language is carried through so a rewrite is visible as a rewrite.
 */
function StateChangeDetail({
  left,
  right,
  changes,
}: {
  left: CoverageRecord
  right: CoverageRecord
  changes: ChangesPayload | null
}) {
  const columns = [left, right]
  const anyMovement = columns.some(
    (r) => historyFor(r).length > 1 || (changes?.events ?? []).some((e) => e.state === r.state),
  )

  return (
    <section className="mt-4 rounded-lg border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">How each state got here</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Dated policy versions read from each state's own documents, and every change event attributed to it. Medicaid
          publishes no change feed, so each entry says how it was established.
        </p>
      </div>

      {!anyMovement ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No dated movement recorded for either state. Neither one's documents described a prior version, and no
          announcement was found — which for a stable policy is the correct answer.
        </p>
      ) : (
        <div className="grid md:grid-cols-2">
          {columns.map((record, i) => {
            const versions = historyFor(record)
            const events = (changes?.events ?? []).filter((e) => e.state === record.state)
            return (
              <article key={record.state} className={`p-4 ${i === 0 ? "border-b md:border-b-0 md:border-r" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{record.stateName}</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {versions.length} dated version{versions.length === 1 ? "" : "s"} · {events.length} event
                    {events.length === 1 ? "" : "s"}
                  </span>
                </div>

                {versions.length > 1 ? (
                  <ol className="mt-4 flex flex-col">
                    {versions.map((v, idx) => (
                      <li key={`${v.effectiveDate ?? v.documentDate ?? idx}-${idx}`} className="relative pb-4 pl-5 last:pb-0">
                        <span
                          className="absolute left-0 top-1 size-2.5 rounded-full ring-2 ring-card"
                          style={{ background: STATUS_COLOR[v.status] }}
                        />
                        {idx < versions.length - 1 && (
                          <span className="absolute left-[4.5px] top-4 h-full w-px bg-border" aria-hidden />
                        )}
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs font-semibold">{STATUS_LABEL[v.status]}</span>
                          {v.isCurrent && (
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              in force
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {v.effectiveDate ? `effective ${formatDate(v.effectiveDate)}` : formatDate(v.documentDate)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          friction {v.frictionIndex}/100
                          {v.frictionFlags.length > 0 && ` · ${v.frictionFlags.map((f) => FRICTION_LABELS[f]).join(", ")}`}
                        </div>
                        {v.criteriaVerbatim && (
                          <blockquote className="mt-2 border-l-2 border-border pl-2 text-[11px] italic leading-4 text-muted-foreground">
                            “{v.criteriaVerbatim.slice(0, 220)}
                            {v.criteriaVerbatim.length > 220 ? "…" : ""}”
                          </blockquote>
                        )}
                        {!v.criteriaVerbatim && v.criteriaSummary && (
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{v.criteriaSummary}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Only one dated version found. The scan did not surface a document describing a prior rule for{" "}
                    {record.stateName}.
                  </p>
                )}

                {events.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Change events
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {events.slice(0, 5).map((e) => (
                        <li key={e.id}>
                          <div className="flex items-start gap-1.5 text-xs">
                            {e.frictionDelta < 0 ? (
                              <TrendingDown className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--policy-covered)" }} />
                            ) : (
                              <TrendingUp className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--policy-limited)" }} />
                            )}
                            <span className="min-w-0 font-medium leading-5">{e.headline}</span>
                          </div>
                          {e.detail && <p className="mt-0.5 pl-5 text-[11px] leading-4 text-muted-foreground">{e.detail}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 pl-5 text-[11px] text-muted-foreground">
                            <ProvenanceBadge provenance={e.provenance} />
                            <span>{formatDate(e.announcedOn)}</span>
                            {e.effectiveOn && <span>· effective {formatDate(e.effectiveOn)}</span>}
                            {e.sourceUrl && (
                              <a
                                href={e.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary hover:underline"
                              >
                                source
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Picker({
  label,
  value,
  excluded,
  records,
  onChange,
}: {
  label: string
  value: string
  excluded: string
  records: CoverageRecord[]
  onChange: (code: string) => void
}) {
  return (
    <label className="min-w-48">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
      >
        {records.map((r) => (
          <option key={r.state} value={r.state} disabled={r.state === excluded}>
            {r.stateName} ({r.state})
          </option>
        ))}
      </select>
    </label>
  )
}

/* --------------------------------------------------------------- directory */

export function StateDirectory({
  records,
  onSelect,
}: {
  records: CoverageRecord[]
  onSelect: (r: CoverageRecord) => void
}) {
  const [q, setQ] = useState("")
  const filtered = records.filter((r) => `${r.stateName} ${r.state}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="relative mt-5 max-w-sm">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-full rounded-md border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          placeholder="Find a state"
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => (
          <button
            key={r.state}
            onClick={() => onSelect(r)}
            className="rounded-lg border bg-card p-4 text-left hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.stateName}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.state}</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-sm" style={{ background: STATUS_COLOR[r.status] }} />
              {STATUS_LABEL[r.status]}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${r.frictionIndex}%`, background: frictionColor(r.frictionIndex) }}
                />
              </span>
              <span className="font-mono text-[11px] font-semibold">{r.frictionIndex}</span>
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
              <span>Effective {formatDate(r.effectiveDate)}</span>
              <span>Verified {relativeTime(r.lastCheckedAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
