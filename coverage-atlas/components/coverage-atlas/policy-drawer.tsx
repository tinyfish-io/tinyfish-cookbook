"use client"

import { useState } from "react"
import { AlertTriangle, ExternalLink, GitCompareArrows, Loader2, Pin, RefreshCw, X } from "lucide-react"
import {
  AUTH_LABEL,
  CONFIDENCE_LABEL,
  FRICTION_LABELS,
  METHOD_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  formatDate,
  frictionColor,
  isInferred,
  relativeTime,
  type CoverageRecord,
} from "@/lib/atlas"
import { historyFor } from "@/agent/lib/derive"

/**
 * One state, in full: the decision, the friction ledger that produced its score,
 * the verbatim policy language, and the evidence trail.
 *
 * "Check again now" is the honest part. Every record says when it was last
 * verified and by which rung of the ladder, and any record can be re-read on the
 * spot against the state's own source — including through a stealth browser when
 * the state portal refuses plain fetchers, which many of them do. If the answer
 * comes back different, that disagreement is written to the change feed rather
 * than quietly patched.
 */
export function PolicyDrawer({
  record,
  conditionSlug,
  conditionName,
  pinned,
  onPin,
  onCompare,
  onClose,
  onVerified,
}: {
  record: CoverageRecord
  conditionSlug: string
  conditionName: string
  pinned: boolean
  onPin: () => void
  onCompare: () => void
  onClose: () => void
  onVerified: (record: CoverageRecord, changed: boolean) => void
}) {
  const [verifying, setVerifying] = useState(false)
  const [outcome, setOutcome] = useState<{ changed: boolean; note: string } | null>(null)

  async function verify() {
    setVerifying(true)
    setOutcome(null)
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: record.state, condition: conditionSlug }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const fresh = data.record as CoverageRecord
      setOutcome({
        changed: Boolean(data.changed),
        note: data.changed
          ? `Re-read disagreed with what we held. Record and change feed updated.`
          : data.shortCircuited
            ? `Source document is byte-for-byte unchanged since the last scan.`
            : `Re-read agrees with the stored record.`,
      })
      onVerified(fresh, Boolean(data.changed))
    } catch (err) {
      setOutcome({ changed: false, note: `Re-check failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${record.stateName} policy details`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-background p-5">
          <div className="min-w-0">
            <div className="mb-1 text-xs font-semibold text-primary">{record.state} · Medicaid fee-for-service</div>
            <h2 className="text-xl font-semibold">{record.stateName}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-sm" style={{ background: STATUS_COLOR[record.status] }} />
              {STATUS_LABEL[record.status]}
              {record.effectiveDate && ` · effective ${formatDate(record.effectiveDate)}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close details">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-2 border-b p-4">
          <button
            onClick={onPin}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <Pin className="size-3.5" />
            {pinned ? "Unpin" : "Pin state"}
          </button>
          <button
            onClick={onCompare}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <GitCompareArrows className="size-3.5" />
            Compare
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5">
          {isInferred(record) && (
            <div className="flex items-start gap-2.5 rounded-md border border-[var(--policy-limited)]/40 bg-[var(--difference)] p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--policy-limited)" }} />
              <div className="text-xs leading-5">
                <strong>Not verified against a source.</strong> The scan's call budget closed before this state was
                resolved, so this record is the model's best understanding rather than something read from a document.
                Re-check it below, or re-run the scan with a higher ceiling.
              </div>
            </div>
          )}

          <Section title="Access friction">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{record.frictionIndex}</span>
              <span className="text-xs text-muted-foreground">/ 100 friction · access score {record.accessScore}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${record.frictionIndex}%`, background: frictionColor(record.frictionIndex) }}
              />
            </div>
            {record.frictionFlags.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {record.frictionFlags.map((flag) => (
                  <li key={flag} className="flex items-center justify-between border-b pb-1.5 text-xs last:border-b-0">
                    <span>{FRICTION_LABELS[flag]}</span>
                    <span className="text-muted-foreground">documented</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3">
                No administrative gate is documented in the source for {record.stateName}. The score is derived from
                the gates the policy actually states — never inferred.
              </p>
            )}
          </Section>

          <Section title="Access requirements">
            <Row label="Authorization" value={AUTH_LABEL[record.authorization]} />
            <Row label="Administering entity" value={record.administeringEntity ?? "Not named in source"} />
            <Row label="Effective date" value={formatDate(record.effectiveDate)} />
            <Row label="Source document dated" value={formatDate(record.documentDate)} />
          </Section>

          {record.criteriaSummary && (
            <Section title="What the policy says">
              <p className="!text-sm !text-foreground">{record.criteriaSummary}</p>
            </Section>
          )}

          {record.criteriaVerbatim && (
            <Section title="Verbatim criteria">
              <blockquote className="rounded-md border-l-2 border-primary bg-muted/40 p-3 text-xs italic leading-5">
                “{record.criteriaVerbatim}”
              </blockquote>
              <p className="mt-2">
                Quoted exactly. Paraphrase blurs distinctions that decide whether a specific patient qualifies, so the
                original wording is always kept underneath the summary.
              </p>
            </Section>
          )}

          <PolicyHistory record={record} />

          <Section title="Evidence">
            <div className="rounded-md border p-3">
              <div className="text-xs font-semibold">{record.sourceDoc ?? "No source document captured"}</div>
              {record.sourceUrl && (
                <a
                  href={record.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Open source <ExternalLink className="size-3" />
                </a>
              )}
              <div className="mt-3 flex flex-col gap-1 border-t pt-2 text-[11px] text-muted-foreground">
                <span className="flex justify-between">
                  <span>Obtained by</span>
                  <span className="font-medium text-foreground">{METHOD_LABEL[record.method]}</span>
                </span>
                <span className="flex justify-between">
                  <span>Extraction confidence</span>
                  <span className="font-medium text-foreground">{CONFIDENCE_LABEL[record.confidence]}</span>
                </span>
                <span className="flex justify-between">
                  <span>Last verified by scanner</span>
                  <span className="font-medium text-foreground">{relativeTime(record.lastCheckedAt)}</span>
                </span>
              </div>
            </div>
            {record.notes && <p className="mt-2">{record.notes}</p>}

            <button
              onClick={verify}
              disabled={verifying}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {verifying ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {verifying ? `Re-reading ${record.stateName}'s source…` : "Check again now"}
            </button>
            {outcome && (
              <p
                className={`mt-2 rounded-md p-2 !text-[11px] ${outcome.changed ? "bg-[var(--difference)] !text-foreground" : "bg-muted !text-muted-foreground"}`}
              >
                {outcome.note}
              </p>
            )}
          </Section>

          <p className="border-t pt-4 text-[11px] leading-4 text-muted-foreground">
            {conditionName} · Medicaid fee-for-service only. Managed-care plans may apply their own criteria on top.
            Verify against the state's official publication before making a clinical or financial decision.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="text-sm leading-6 text-foreground [&_p]:text-xs [&_p]:text-muted-foreground">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  )
}


/**
 * The dated versions of this state's policy that the scan found.
 *
 * Rendered whenever there is more than one, because a single version is just the
 * record above restated. Two or more is a timeline, and a timeline is the thing
 * that makes a coverage record actionable — it says whether the rule you are
 * reading has been stable for years or was rewritten last quarter.
 */
function PolicyHistory({ record }: { record: CoverageRecord }) {
  const versions = historyFor(record)
  if (versions.length < 2) return null

  return (
    <Section title={`Policy history · ${versions.length} dated versions`}>
      <ol className="flex flex-col">
        {versions.map((v, i) => (
          <li key={`${v.effectiveDate ?? v.documentDate ?? i}-${i}`} className="relative pb-4 pl-5 last:pb-0">
            <span
              className="absolute left-0 top-1.5 size-2.5 rounded-full ring-2 ring-background"
              style={{ background: STATUS_COLOR[v.status] }}
            />
            {i < versions.length - 1 && <span className="absolute left-[4.5px] top-4 h-full w-px bg-border" aria-hidden />}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs font-semibold">{STATUS_LABEL[v.status]}</span>
              {v.isCurrent && (
                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">in force</span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {v.effectiveDate ? `effective ${formatDate(v.effectiveDate)}` : formatDate(v.documentDate)}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">friction {v.frictionIndex}/100</div>
            {v.criteriaVerbatim && (
              <blockquote className="mt-1.5 border-l-2 border-border pl-2 text-[11px] italic leading-4 text-muted-foreground">
                “{v.criteriaVerbatim.slice(0, 200)}
                {v.criteriaVerbatim.length > 200 ? "…" : ""}”
              </blockquote>
            )}
            {!v.criteriaVerbatim && v.criteriaSummary && (
              <p className="mt-1 !text-[11px] leading-4">{v.criteriaSummary}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-1">
        Read from dated documents during the scan. Medicaid publishes no change feed, so a timeline like this has to be
        assembled from the policies' own self-reference.
      </p>
    </Section>
  )
}
