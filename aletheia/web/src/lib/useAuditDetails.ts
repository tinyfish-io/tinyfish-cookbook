import { useEffect, useRef, useState } from "react";

import { getAudit } from "./api.ts";
import type { AuditSummary, AuditView } from "./types.ts";

const finishedSites = ({ sites }: AuditSummary) =>
  sites.filter((site) => site.state === "done").length;

/**
 * The list endpoint gives counts only, so the patterns named on each row and its first price come
 * from the full audit. A row refetches when another of its sites finishes.
 */
export function useAuditDetails(audits: readonly AuditSummary[]): Record<string, AuditView> {
  const [details, setDetails] = useState<Record<string, AuditView>>({});
  const asked = useRef(new Map<string, number>());

  useEffect(() => {
    for (const audit of audits) {
      const finished = finishedSites(audit);
      if (finished === 0 || asked.current.get(audit.id) === finished) continue;
      asked.current.set(audit.id, finished);
      getAudit(audit.id).then(
        (view) => setDetails((current) => ({ ...current, [view.id]: view })),
        () => asked.current.delete(audit.id),
      );
    }
  }, [audits]);

  return details;
}
