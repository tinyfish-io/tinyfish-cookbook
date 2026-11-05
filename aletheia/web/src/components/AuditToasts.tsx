import { useEffect, useRef, useState } from "react";

import { siteName } from "../lib/sites.ts";
import type { AuditPublic, SiteView } from "../lib/types.ts";
import { Cross } from "./icons.tsx";

const READY_MS = 7000;

function readyLine({ host, name: known, report }: SiteView): string {
  const found = report?.patterns.filter((entry) => entry.status === "found").length ?? 0;
  const name = siteName(host, known);
  if (found === 0) return `No dark pattern found on ${name} so far.`;
  return `${found} ${found === 1 ? "pattern" : "patterns"} found on ${name}.`;
}

/** The write-up can take minutes, so these say what is going on without taking the page over. */
export function AuditToasts({ audit }: { audit: AuditPublic }) {
  const writing = audit.sites.some((site) => site.state === "writing_up");
  const reported = useRef(new Set(audit.sites.filter((site) => site.report).map(({ id }) => id)));
  const [ready, setReady] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const fresh = audit.sites.filter((site) => site.report && !reported.current.has(site.id));
    if (fresh.length === 0) return;
    for (const { id } of fresh) reported.current.add(id);
    setReady((current) => [
      ...current,
      ...fresh.map((site) => ({ id: site.id, text: readyLine(site) })),
    ]);
  }, [audit.sites]);

  useEffect(() => {
    if (ready.length === 0) return;
    const timer = setTimeout(() => setReady((current) => current.slice(1)), READY_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <div
      aria-live="polite"
      className="fixed right-4 bottom-4 left-4 z-40 flex flex-col items-end gap-3 sm:left-auto sm:w-[300px]"
    >
      {writing ? (
        <div className="toast-in card w-full px-[18px] py-4">
          <p className="font-semibold text-ink">Writing up the report...</p>
          <p className="text-[13px] text-mute">This can take a few minutes.</p>
        </div>
      ) : null}
      {ready.map(({ id, text }) => (
        <div key={id} className="toast-in card flex w-full items-start gap-2 py-4 pr-2.5 pl-[18px]">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Report ready</p>
            <p className="text-[13px] text-mute">{text}</p>
          </div>
          <button
            type="button"
            className="round-button shrink-0"
            aria-label="Dismiss"
            onClick={() => setReady((current) => current.filter((entry) => entry.id !== id))}
          >
            <Cross size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
