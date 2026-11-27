import { useEffect, useState } from "react";

import { ApiFailure, auditEventsUrl, getAudit } from "./api.ts";
import { auditIsLive } from "./live.ts";
import type { AuditView } from "./types.ts";
import { useLoad } from "./useLoad.ts";

const RETRY_MS = 3000;

/** Follows one audit by id, so a dropped stream always picks up the same run. */
export function useAudit(id: string) {
  const { result, refresh, setResult } = useLoad(id, () => getAudit(id));
  const [reconnecting, setReconnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = result.state === "ready" && auditIsLive(result.data);

  useEffect(() => {
    if (!live) return;
    const events = new EventSource(auditEventsUrl(id));
    let retry: ReturnType<typeof setTimeout> | undefined;

    function show(audit: AuditView) {
      setResult({ state: "ready", data: audit });
      // The server ends the stream here, and leaving it open would reconnect forever.
      if (!auditIsLive(audit)) events.close();
    }

    events.addEventListener("audit", (event) => {
      setReconnecting(false);
      show(JSON.parse((event as MessageEvent<string>).data) as AuditView);
    });

    events.onerror = () => {
      setReconnecting(true);
      if (events.readyState === EventSource.CONNECTING) return;

      // EventSource gives up on any error status, such as a 502 during a redeploy.
      retry = setTimeout(() => setAttempt((count) => count + 1), RETRY_MS);
      getAudit(id).then(show, (error: unknown) => {
        if (!(error instanceof ApiFailure) || error.code !== "not_found") return;
        clearTimeout(retry);
        setResult({ state: "failed", code: error.code, message: error.message });
      });
    };

    return () => {
      clearTimeout(retry);
      events.close();
    };
  }, [id, live, attempt, setResult]);

  return { result, reconnecting: live && reconnecting, refresh };
}
