import { useEffect, useState } from "react";

import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Bin } from "../components/icons.tsx";
import {
  Failed,
  Link,
  Loading,
  Money,
  Notice,
  Pill,
  SiteAvatar,
  usePageTitle,
} from "../components/ui.tsx";
import { deleteAudit, listAudits } from "../lib/api.ts";
import { dateTime, plural } from "../lib/format.ts";
import { stepLine, timeEstimate } from "../lib/live.ts";
import { tallyLine } from "../lib/report.ts";
import { siteName } from "../lib/sites.ts";
import { priceChange, rowPills } from "../lib/story.ts";
import type { AuditSummary, AuditView, SiteReport, SiteView } from "../lib/types.ts";
import { useAuditDetails } from "../lib/useAuditDetails.ts";
import { useLoad } from "../lib/useLoad.ts";

const REFRESH_MS = 5000;
const MAX_PICKED = 4;

type SummarySite = AuditSummary["sites"][number];

const doneSites = ({ sites }: AuditSummary) => sites.filter((site) => site.state === "done").length;

/** Empty on most rows. A price shows only when it moved. */
function Change({ report }: { report: SiteReport | null }) {
  const change = report ? priceChange(report) : null;
  if (!change || change.from === null || change.to === null) {
    return <span className="row-amount" />;
  }
  const { from, to, suffix, currency } = change;
  return (
    <span className="row-amount">
      <span className="flex items-baseline gap-1.5 text-sm font-semibold whitespace-nowrap text-ink lg:justify-end">
        <s className="num font-medium text-mute decoration-1">
          <span className="sr-only">Shown as </span>
          <Money amount={from} currency={currency} plain />
        </s>
        <span aria-hidden="true" className="font-normal text-mute">
          &rarr;
        </span>
        <Money amount={to} currency={currency} suffix={suffix} plain />
      </span>
    </span>
  );
}

/** While a site runs, the step it is on and how long is left. The list refreshes every few seconds. */
function LiveLine({ site }: { site: SummarySite }) {
  const step =
    site.state === "writing_up"
      ? "Writing up the report"
      : site.state === "running"
        ? stepLine(site.stepCount, site.latestStep)
        : null;
  const estimate = timeEstimate(site, Date.now());
  if (!step && !estimate) return null;
  return (
    <span className="w-full text-[13px]">
      {step ? <span className="block font-medium wrap-anywhere text-ink">{step}</span> : null}
      {estimate ? <span className="num block text-mute">{estimate}</span> : null}
    </span>
  );
}

interface SiteRowProps {
  audit: AuditSummary;
  site: SummarySite;
  detail: SiteView | null;
  /** The compare tick and delete button. A multi-site audit has them on its header line. */
  controls: AuditControlsProps | null;
  /** Dropped under a multi-site header, which already says it. */
  showTask: boolean;
}

function SiteRow({ audit, site, detail, controls, showTask }: SiteRowProps) {
  const report = detail?.report ?? null;
  const href = `/audits/${audit.id}${detail && !showTask ? `#site-${detail.id}` : ""}`;
  const who = report ? (report.signedIn ? "signed in" : "guest") : null;
  const line = showTask
    ? [audit.task, dateTime(audit.createdAt), who]
    : [report?.item ?? site.host, who];

  return (
    <div className="audit-row">
      <div className="row-pick">{controls ? <PickBox {...controls} /> : null}</div>
      <div className="row-avatar">
        <SiteAvatar host={site.host} />
      </div>
      <div className="row-name min-w-0">
        <Link
          href={href}
          className="text-base font-semibold text-ink after:absolute after:inset-0 after:rounded-2xl"
        >
          {siteName(site.host, site.name)}
        </Link>
        <p className="text-[13px] wrap-anywhere text-mute">{line.filter(Boolean).join(" · ")}</p>
      </div>
      <div className="row-status">
        {rowPills(site, report).map((pill) => (
          <Pill key={pill.text} {...pill} />
        ))}
        {site.state === "done" ? (
          <span className="num w-full text-[13px] text-mute">{tallyLine(site)}</span>
        ) : null}
        <LiveLine site={site} />
      </div>
      <Change report={report} />
      <div className="row-delete">{controls ? <DeleteRow {...controls} /> : null}</div>
    </div>
  );
}

interface AuditControlsProps {
  audit: AuditSummary;
  picked: boolean;
  canPick: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function PickBox({ audit, picked, canPick, onToggle }: AuditControlsProps) {
  if (doneSites(audit) === 0) return null;
  return (
    <label className="relative z-1 grid size-11 place-items-center">
      <input
        type="checkbox"
        checked={picked}
        disabled={!picked && !canPick}
        onChange={onToggle}
        className="size-[18px] rounded accent-ink"
      />
      <span className="sr-only">Compare: {audit.task}</span>
    </label>
  );
}

function DeleteRow({ audit, onDelete }: AuditControlsProps) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Delete: ${audit.task}`}
      className="relative z-1 grid size-11 place-items-center rounded-full text-mute transition-colors hover:bg-rose hover:text-rose-ink"
    >
      <Bin />
    </button>
  );
}

interface AuditEntryProps extends AuditControlsProps {
  detail: AuditView | undefined;
}

function AuditEntry({ detail, ...controls }: AuditEntryProps) {
  const { audit } = controls;
  const detailOf = (site: SummarySite) =>
    detail?.sites.find((entry) => entry.host === site.host) ?? null;

  const only = audit.sites.length === 1 ? audit.sites[0] : undefined;
  if (only) {
    return (
      <li>
        <SiteRow
          audit={audit}
          site={only}
          detail={detailOf(only)}
          controls={controls}
          showTask={true}
        />
      </li>
    );
  }

  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-x-4 px-[6px] pt-2">
        <div className="flex min-w-0 items-center">
          <PickBox {...controls} />
          <p className="min-w-0 pl-1 text-[13px] wrap-anywhere text-mute">
            <Link href={`/audits/${audit.id}`} className="link font-semibold text-ink">
              {audit.task}
            </Link>
            {` · ${dateTime(audit.createdAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {doneSites(audit) >= 2 ? (
            <Link
              href={`/compare?audits=${audit.id}`}
              className="link inline-flex min-h-11 items-center"
            >
              Compare these sites
            </Link>
          ) : null}
          <DeleteRow {...controls} />
        </div>
      </div>
      {audit.sites.map((site) => (
        <SiteRow
          key={site.host}
          audit={audit}
          site={site}
          detail={detailOf(site)}
          controls={null}
          showTask={false}
        />
      ))}
    </li>
  );
}

function ComparePick({ audits }: { audits: AuditSummary[] }) {
  const sites = audits.reduce((sum, audit) => sum + doneSites(audit), 0);
  return (
    <div className="sticky bottom-4 z-20 flex justify-center">
      <div className="rise card flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full py-2 pr-2 pl-5">
        <p className="text-sm">
          {plural(audits.length, "audit")} picked, {plural(sites, "finished site")}
        </p>
        {sites >= 2 ? (
          <Link
            className="btn btn-dark btn-sm"
            href={`/compare?audits=${audits.map((audit) => audit.id).join(",")}`}
          >
            Compare side by side
          </Link>
        ) : (
          <p className="pr-3 text-sm text-mute">Pick one more to compare.</p>
        )}
      </div>
    </div>
  );
}

function CompareSelected({ audits }: { audits: AuditSummary[] }) {
  const sites = audits.reduce((sum, audit) => sum + doneSites(audit), 0);
  if (sites < 2) {
    return (
      <button type="button" className="btn btn-soft btn-sm" disabled>
        Compare selected
      </button>
    );
  }
  return (
    <Link
      className="btn btn-soft btn-sm"
      href={`/compare?audits=${audits.map((audit) => audit.id).join(",")}`}
    >
      Compare selected
    </Link>
  );
}

export function PastAudits() {
  usePageTitle("Past audits");
  const { result, refresh } = useLoad("audits", listAudits);
  const [picked, setPicked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<AuditSummary | null>(null);
  const anyRunning =
    result.state === "ready" && result.data.some((audit) => audit.status === "running");

  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [anyRunning, refresh]);

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  const audits = result.state === "ready" ? result.data : [];
  const details = useAuditDetails(audits);
  const pickedAudits = audits.filter((audit) => picked.includes(audit.id));

  return (
    <div className="flex flex-col">
      <section aria-labelledby="audits-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 id="audits-title" className="text-[28px]/[1.1] sm:text-[34px]/[1.1]">
            Past audits
          </h1>
          {audits.length > 0 ? <CompareSelected audits={pickedAudits} /> : null}
        </div>

        {result.state === "loading" ? <Loading what="Fetching your audits." /> : null}
        {result.state === "failed" ? (
          <Failed message={result.message} onRetry={() => void refresh()} />
        ) : null}

        {result.state === "ready" && audits.length === 0 ? (
          <Notice
            title="No audits yet"
            action={
              <Link className="btn btn-ring" href="/">
                Run your first audit
              </Link>
            }
          >
            Say what you want to buy or sign up for, and Aletheia reports every dark pattern it
            sees.
          </Notice>
        ) : null}

        {audits.length > 0 ? (
          <ul className="rise card divide-y divide-line p-2">
            {audits.map((audit) => (
              <AuditEntry
                key={audit.id}
                audit={audit}
                detail={details[audit.id]}
                picked={picked.includes(audit.id)}
                canPick={picked.length < MAX_PICKED}
                onToggle={() => toggle(audit.id)}
                onDelete={() => setDeleting(audit)}
              />
            ))}
          </ul>
        ) : null}

        {pickedAudits.length > 0 ? <ComparePick audits={pickedAudits} /> : null}
      </section>

      {deleting ? (
        <ConfirmDialog
          title="Delete this audit?"
          confirmLabel={deleting.status === "running" ? "Stop and delete" : "Delete audit"}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteAudit(deleting.id);
            setPicked((current) => current.filter((entry) => entry !== deleting.id));
            setDeleting(null);
            await refresh();
          }}
        >
          {deleting.task}. The report, its screenshots and any share link go for good.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
