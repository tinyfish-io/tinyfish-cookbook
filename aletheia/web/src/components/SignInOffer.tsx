import { useState } from "react";

import { signOut, startAudit } from "../lib/api.ts";
import { rememberSignIn } from "../lib/signInMemory.ts";
import { navigate } from "../lib/useRoute.ts";
import type { SignInView, SiteReport } from "../lib/types.ts";
import { SignInPanel } from "./SignInPanel.tsx";

interface SignInOfferProps {
  label: string;
  report: SiteReport;
  task: string;
  country: string | null;
}

/** A guest report is already a result, so this only ever adds a second check of one site. */
export function SignInOffer({ label, report, task, country }: SignInOfferProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function check({ id }: SignInView) {
    setOpen(false);
    try {
      const audit = await startAudit({
        task,
        flow: report.flow,
        ...(country ? { country } : {}),
        sites: [{ url: report.url, signInId: id }],
      });
      rememberSignIn(audit.id, report.url, id);
      navigate(`/audits/${audit.id}`);
    } catch (error) {
      void signOut(id).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "The check could not start.");
    }
  }

  return (
    <div className="flex max-w-[440px] shrink-0 flex-col items-start gap-1.5 sm:items-end sm:text-right">
      <button type="button" className="btn btn-dark" onClick={() => setOpen(true)}>
        {label}
      </button>
      {message ? (
        <p role="alert" className="font-medium text-peach-ink">
          {message}
        </p>
      ) : null}
      {open ? (
        <SignInPanel
          url={report.url}
          host={report.host}
          country={country}
          onReady={(signIn) => void check(signIn)}
          onClosed={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
