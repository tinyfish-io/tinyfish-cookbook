import type { ownerView, sharedView, summaryView } from "../../../server/src/api/views.ts";
import type { AuditPlan } from "../../../server/src/plan/types.ts";

export type {
  Bill,
  Charge,
  Page,
  PatternFinding,
  PatternId,
  PatternStatus,
  Screenshot,
  Severity,
  SubscriptionSummary,
} from "../../../server/src/judge/types.ts";

export type { Flow } from "../../../server/src/judge/types.ts";
export { PATTERN_IDS } from "../../../server/src/judge/types.ts";

export type PlanView = AuditPlan;
export type AuditView = ReturnType<typeof ownerView>;
/** What every audit screen can draw, so a report opened from a shared link works the same way. */
export type AuditPublic = ReturnType<typeof sharedView>;
export type AuditSummary = ReturnType<typeof summaryView>;
export type SiteView = AuditPublic["sites"][number];
/** A report as served, with its severity summary worked out on the server. */
export type SiteReport = NonNullable<SiteView["report"]>;

export type {
  ManualReason,
  SignInAction,
  SignInView,
  StepView,
} from "../../../server/src/signin/views.ts";

export interface ScreenFrame {
  /** A base64 JPEG. */
  data: string;
  width: number;
  height: number;
}
