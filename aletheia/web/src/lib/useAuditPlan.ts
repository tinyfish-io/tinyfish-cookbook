import { useEffect, useState } from "react";

import { planAudit } from "./api.ts";
import type { PlanView } from "./types.ts";

const TYPING_PAUSE_MS = 450;
const MIN_TASK_LENGTH = 3;

export interface AuditPlanState {
  plan: PlanView | null;
  /** The shown plan is for older words, and a newer one is on its way. */
  pending: boolean;
  failed: boolean;
}

/** Asks the server to plan once typing pauses. A slower older answer never replaces a newer one. */
export function useAuditPlan(task: string): AuditPlanState {
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const words = task.trim();

  useEffect(() => {
    let current = true;
    const ready = words.length >= MIN_TASK_LENGTH;
    setPending(ready);

    const timer = setTimeout(
      () => {
        planAudit(ready ? words : "").then(
          (next) => {
            if (!current) return;
            setPlan(next);
            setPending(false);
            setFailed(false);
          },
          () => {
            if (!current) return;
            setPending(false);
            setFailed(true);
          },
        );
      },
      ready ? TYPING_PAUSE_MS : 0,
    );

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [words]);

  return { plan, pending, failed };
}
