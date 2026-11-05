import type { ReportScope } from "../lib/api.ts";
import { screenshotUrl } from "../lib/api.ts";
import { money, plural } from "../lib/format.ts";
import { counts, logoutNote, olderAuditNote, signInOffer, stopSummary } from "../lib/report.ts";
import { siteName } from "../lib/sites.ts";
import type { Story } from "../lib/story.ts";
import { renewalNote, stats, story } from "../lib/story.ts";
import type { SiteReport, SiteView } from "../lib/types.ts";
import { Findings, FindingsSummary } from "./Findings.tsx";
import { PatternList } from "./PatternList.tsx";
import { Screenshot } from "./Screenshot.tsx";
import { SignInOffer } from "./SignInOffer.tsx";
import { SubscriptionFacts } from "./SubscriptionFacts.tsx";
import { SiteAvatar } from "./ui.tsx";

const FLOW_LABEL = { checkout: "Checkout", subscription: "Subscription sign-up" } as const;

const BADGE: Record<Story["tone"], string> = {
  found: "pill-found",
  open: "pill-unchecked",
  clear: "pill-clean",
};

interface FindingCopyProps {
  told: Story;
  report: SiteReport;
  site: SiteView;
  /** With one site the headline is the site's heading, with several the site name is. */
  Heading: "h2" | "h3";
  /** What was audited, which only this block can say when the audit has one site. */
  detail: string | null;
}

function FindingCopy({ told, report, site, Heading, detail }: FindingCopyProps) {
  return (
    <div className="min-w-0">
      <span className={`pill ${BADGE[told.tone]}`}>
        {told.tone === "found" ? <span aria-hidden="true" className="dot" /> : null}
        {told.badge}
      </span>
      <Heading
        id={`site-title-${site.id}`}
        className="mt-4 text-[34px]/[1.08] tracking-[-0.03em] wrap-anywhere sm:text-[46px]/[1.05]"
      >
        {told.lead} <span className="accent">{told.accent}</span>
        {told.tail === "." ? "." : ` ${told.tail}`}
      </Heading>
      <p className="mt-4 max-w-[440px] text-base text-body sm:text-[17px]">{told.body}</p>

      <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-3 sm:gap-x-10">
        {stats(report, site.steps.length).map(({ value, label }) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-[13px] text-mute">{label}</dt>
            <dd className="num text-[22px] font-semibold tracking-[-0.02em] text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[13px] text-mute">
        {detail ? `${detail}. ` : null}
        {told.body === stopSummary(report) ? null : stopSummary(report)}
      </p>
    </div>
  );
}

function PagesWalked({
  report,
  siteId,
  scope,
}: {
  report: SiteReport;
  siteId: string;
  scope: ReportScope;
}) {
  if (report.pages.length === 0) return null;
  return (
    <details className="card group px-5 sm:px-6">
      <summary className="flex min-h-14 items-center text-lg font-semibold tracking-[-0.02em] text-ink">
        Every page the agent reached ({report.pages.length})
      </summary>
      <ol className="grid gap-5 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        {report.pages.map((page) => (
          <li key={page.step} className="flex min-w-0 flex-col gap-2">
            <p className="min-w-0 wrap-break-word">
              <span className="font-mono text-[13px] text-mute">{page.step}</span> {page.name}
              {page.price === null ? null : (
                <span className="num"> {money(page.price, report.bill.currency)}</span>
              )}
            </p>
            {page.screenshot ? (
              <Screenshot
                src={screenshotUrl(scope, siteId, page.screenshot.stepId)}
                label={`Step ${page.step}: ${page.name}`}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Tally({ report }: { report: SiteReport }) {
  const { found, notChecked, notFound } = counts(report);
  return (
    <span className="num text-[13px] font-normal text-mute">
      {found} found, {notChecked} not checked, {notFound} not found
    </span>
  );
}

interface ReportCardProps {
  site: SiteView;
  report: SiteReport;
  task: string;
  country: string | null;
  scope: ReportScope;
  press: boolean;
  /** The only site in the audit, so the crumb bar has already named it. */
  solo: boolean;
}

export function ReportCard({ site, report, task, country, scope, press, solo }: ReportCardProps) {
  const logout = logoutNote(site.logout);
  const told = story(report);
  const older = olderAuditNote(report);
  const offer = scope.kind === "owner" ? signInOffer(report) : null;
  const unseen = report.missing.length > 0 || offer !== null;
  const detail = [
    report.item,
    FLOW_LABEL[report.flow],
    report.signedIn ? "Signed in for one check" : "Guest",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <article
      id={`site-${site.id}`}
      aria-labelledby={`site-title-${site.id}`}
      className="flex scroll-mt-24 flex-col gap-8"
    >
      {solo ? null : (
        <header className="flex items-center gap-3">
          <SiteAvatar host={site.host} />
          <div className="min-w-0">
            <h2 id={`site-title-${site.id}`} className="text-2xl wrap-anywhere">
              {siteName(report.host, report.name)}
            </h2>
            <p className="text-mute">{detail}</p>
          </div>
        </header>
      )}

      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <FindingsSummary report={report} siteId={site.id} />
        <FindingCopy
          told={told}
          report={report}
          site={site}
          Heading={solo ? "h2" : "h3"}
          detail={solo ? detail : null}
        />
      </div>

      {older ? (
        <p className="rounded-[18px] border border-dashed border-dash p-5 text-body">
          <span className="pill pill-unchecked mr-2">Older audit</span>
          {older}
        </p>
      ) : null}

      <Findings report={report} siteId={site.id} scope={scope} Heading={solo ? "h2" : "h3"} />

      {report.subscription ? (
        <SubscriptionFacts
          subscription={report.subscription}
          currency={report.bill.currency}
          renewal={renewalNote(report)}
        />
      ) : null}

      {unseen || report.flags.length > 0 ? (
        <div className={`grid gap-4 ${unseen && report.flags.length > 0 ? "md:grid-cols-2" : ""}`}>
          {unseen ? (
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-[18px] border border-dashed border-dash p-5">
              {report.missing.length > 0 ? (
                <div className="min-w-0 flex-1 basis-72">
                  <h3 className="text-base tracking-[-0.01em]">What this run could not see</h3>
                  <ul className="mt-1 flex flex-col gap-1 text-mute">
                    {report.missing.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {offer ? (
                <SignInOffer label={offer} report={report} task={task} country={country} />
              ) : null}
            </div>
          ) : null}
          {report.flags.length > 0 ? (
            <div className="rounded-[18px] border border-peach-line bg-peach p-5">
              <h3 className="text-base tracking-[-0.01em]">
                {plural(report.flags.length, "thing")} to check in this run
              </h3>
              <ul className="mt-1 flex flex-col gap-1">
                {report.flags.map((flag) => (
                  <li key={flag.kind + flag.detail}>{flag.detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-label={`Patterns checked on ${report.host}`} className="card p-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-3.5 pb-2.5">
          <h3 className="flex flex-wrap items-baseline gap-x-3 text-lg tracking-[-0.02em]">
            Patterns checked <Tally report={report} />
          </h3>
          <p className="text-[13px] text-mute">
            Not checked means the run never saw the page where it could appear, or did not look.
          </p>
        </div>
        <PatternList report={report} siteId={site.id} press={press} />
      </section>

      <PagesWalked report={report} siteId={site.id} scope={scope} />
      {logout ? <p className="text-[13px] text-mute">{logout}</p> : null}
    </article>
  );
}
