import { useEffect, useRef, useState } from "react";

import { AuditToasts } from "../components/AuditToasts.tsx";
import { ComparisonTable } from "../components/ComparisonTable.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { LiveSite } from "../components/LiveSite.tsx";
import { ReportCard } from "../components/ReportCard.tsx";
import { Failed, Link, Loading, Notice, usePageTitle } from "../components/ui.tsx";
import type { ReportScope } from "../lib/api.ts";
import { deleteAudit, deleteSite, getSharedAudit, shareAudit, startAudit } from "../lib/api.ts";
import { buildComparison } from "../lib/compare.ts";
import { dateTime, duration } from "../lib/format.ts";
import { auditIsLive } from "../lib/live.ts";
import { countryChoices } from "../lib/plan.ts";
import { siteName } from "../lib/sites.ts";
import { auditLine } from "../lib/story.ts";
import type { AuditPublic, AuditView, SiteView } from "../lib/types.ts";
import { useAudit } from "../lib/useAudit.ts";
import { useLoad } from "../lib/useLoad.ts";
import { navigate } from "../lib/useRoute.ts";

function useShare(audit: AuditView) {
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setMessage(null);
    try {
      const token = await shareAudit(audit.id);
      const url = `${window.location.origin}/shared/${token}`;
      setLink(url);
      await navigator.clipboard.writeText(url).then(
        () => setMessage("Link copied."),
        () => setMessage("Copy the link below."),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The link could not be made.");
    }
  }

  return { share, link, message };
}

function OwnerActions({ audit }: { audit: AuditView }) {
  const [confirming, setConfirming] = useState(false);
  const live = auditIsLive(audit);
  const { share, link, message } = useShare(audit);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {live ? null : (
          <button type="button" className="btn btn-soft btn-sm" onClick={() => void share()}>
            Share read-only link
          </button>
        )}
        <button type="button" className="btn btn-soft btn-sm" onClick={() => setConfirming(true)}>
          {live ? "Stop and delete" : "Delete"}
        </button>
      </div>
      {link || message ? (
        <div className="flex w-full flex-col items-end gap-1">
          {link ? (
            <label className="flex w-full max-w-md flex-col gap-1 text-[13px] text-mute">
              Anyone with this link can read the report
              <input
                readOnly
                value={link}
                className="field num text-sm"
                onFocus={(event) => event.target.select()}
              />
            </label>
          ) : null}
          {message ? (
            <p role="status" className="text-[13px] text-mute">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={live ? "Stop this audit and delete it?" : "Delete this audit?"}
          confirmLabel={live ? "Stop and delete" : "Delete audit"}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteAudit(audit.id);
            navigate("/audits", { replace: true });
          }}
        >
          The report, its screenshots and any share link go for good.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

/** The home page never asks where the visitor is, so this is the one place to change it. */
function ChangeCountry({ audit }: { audit: AuditView }) {
  const [country, setCountry] = useState(audit.country ?? "ZZ");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runAgain() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await startAudit({ task: audit.task, flow: audit.flow, country });
      navigate(`/audits/${next.id}`);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "The audit could not start.");
    }
  }

  return (
    <details className="-mt-2 w-full text-[13px] text-mute">
      <summary className="inline-flex min-h-11 cursor-pointer items-center sm:min-h-6">
        Change country
      </summary>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label htmlFor="audit-country" className="sr-only">
          Country
        </label>
        <select
          id="audit-country"
          className="field w-auto py-1"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          {countryChoices().map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          disabled={busy}
          onClick={() => void runAgain()}
        >
          {busy ? "Starting" : "Run again from here"}
        </button>
        {message ? <span role="alert">{message}</span> : null}
      </div>
    </details>
  );
}

function RunPill({ audit }: { audit: AuditPublic }) {
  if (auditIsLive(audit)) {
    return (
      <span className="pill pill-live">
        <span aria-hidden="true" className="dot" />
        Running now
      </span>
    );
  }
  const only = audit.sites.length === 1 ? audit.sites[0] : undefined;
  if (only?.state !== "done" || !only.startedAt || !only.finishedAt) return null;
  return (
    <span className="pill pill-live">
      <span aria-hidden="true" className="dot" />
      Finished in {duration(only.startedAt, only.finishedAt)}
    </span>
  );
}

interface SiteSlotProps {
  site: SiteView;
  audit: AuditPublic;
  scope: ReportScope;
  owned: AuditView | null;
  arrivedLive: boolean;
  onChanged: () => void;
}

function DeleteReport({
  site,
  auditId,
  onDeleted,
}: {
  site: SiteView;
  auditId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setConfirming(true)}>
        Delete this report<span className="sr-only"> for {site.host}</span>
      </button>
      {confirming ? (
        <ConfirmDialog
          title={`Delete the ${siteName(site.host, site.name)} report?`}
          confirmLabel="Delete report"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteSite(auditId, site.id);
            onDeleted();
          }}
        >
          This report and its screenshots go for good. The rest of the audit stays.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function SiteSlot({ site, audit, scope, owned, arrivedLive, onChanged }: SiteSlotProps) {
  const { report } = site;

  if (report) {
    return (
      <div className="flex flex-col items-end gap-3">
        <div className="w-full">
          <ReportCard
            site={site}
            report={report}
            task={audit.task}
            country={audit.country ?? null}
            scope={scope}
            press={arrivedLive}
            solo={audit.sites.length === 1}
          />
        </div>
        {owned && audit.sites.length > 1 ? (
          <DeleteReport site={site} auditId={audit.id} onDeleted={onChanged} />
        ) : null}
      </div>
    );
  }
  return <LiveSite site={site} task={audit.task} auditId={owned ? audit.id : null} />;
}

function AuditBody({
  audit,
  scope,
  owned,
  onChanged,
}: {
  audit: AuditPublic;
  onChanged: () => void;
  scope: ReportScope;
  owned: AuditView | null;
}) {
  usePageTitle(audit.task);
  // Reports already there on opening were confirmed earlier, so only new ones fill in.
  const presentAtOpen = useRef(
    new Set(audit.sites.filter((site) => site.report).map((site) => site.id)),
  );
  const comparison = buildComparison([audit]);
  const only = audit.sites.length === 1 ? audit.sites[0] : undefined;

  // Reports load after the page does, so the browser cannot jump to a site's link by itself.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <Link
            href="/audits"
            className="inline-flex min-h-11 items-center text-mute hover:text-ink"
          >
            Past audits
          </Link>
          <span aria-hidden="true" className="text-mute">
            /
          </span>
          <h1 className="min-w-0 text-[15px] font-semibold tracking-normal wrap-anywhere">
            {only ? siteName(only.host, only.name) : audit.task}
          </h1>
          <RunPill audit={audit} />
        </div>
        {owned ? <OwnerActions audit={owned} /> : null}
        <p className="-mt-3 w-full text-[13px] text-mute">
          {only ? `${audit.task} · ` : null}
          <span className="num">{dateTime(audit.createdAt)}</span>
        </p>
        <p className="-mt-3 w-full text-[13px] text-mute">{auditLine(audit)}</p>
        {owned && !auditIsLive(owned) ? <ChangeCountry audit={owned} /> : null}
      </header>

      {comparison.columns.length >= 2 ? (
        <ComparisonTable
          view={comparison}
          showTasks={false}
          foldPatterns
          linkFor={({ key }) => `#site-${key}`}
        />
      ) : null}

      <div className="flex flex-col gap-16">
        {audit.sites.map((site) => (
          <SiteSlot
            key={site.id}
            site={site}
            audit={audit}
            scope={scope}
            owned={owned}
            arrivedLive={!presentAtOpen.current.has(site.id)}
            onChanged={onChanged}
          />
        ))}
      </div>

      <AuditToasts audit={audit} />
    </div>
  );
}

export function AuditPage({ id }: { id: string }) {
  const { result, reconnecting, refresh } = useAudit(id);

  if (result.state === "loading") return <Loading what="Opening the audit." />;
  if (result.state === "failed") {
    if (result.code === "not_found") {
      return (
        <Notice
          title="This audit is gone"
          level="h1"
          action={
            <Link className="btn btn-soft" href="/audits">
              Back to past audits
            </Link>
          }
        >
          It may have been deleted, or it belongs to another browser.
        </Notice>
      );
    }
    return <Failed level="h1" message={result.message} onRetry={() => void refresh()} />;
  }
  return (
    <>
      {reconnecting ? (
        <p role="status" className="mb-4 text-mute">
          Reconnecting to the live view. The agent keeps working.
        </p>
      ) : null}
      <AuditBody
        audit={result.data}
        scope={{ kind: "owner", auditId: id }}
        owned={result.data}
        onChanged={() => void refresh()}
      />
    </>
  );
}

export function SharedPage({ token }: { token: string }) {
  const { result, refresh } = useLoad(token, () => getSharedAudit(token));

  if (result.state === "loading") return <Loading what="Opening the shared report." />;
  if (result.state === "failed") {
    if (result.code === "not_found") {
      return (
        <Notice title="This shared report is gone" level="h1">
          Its owner may have deleted it. Links stop working when the audit is deleted.
        </Notice>
      );
    }
    return <Failed level="h1" message={result.message} onRetry={() => void refresh()} />;
  }
  return (
    <AuditBody
      audit={result.data}
      scope={{ kind: "shared", token }}
      owned={null}
      onChanged={() => void refresh()}
    />
  );
}
