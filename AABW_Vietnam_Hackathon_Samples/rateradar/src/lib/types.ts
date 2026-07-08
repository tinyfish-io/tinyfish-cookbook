export type Bank = {
  id: string;
  name: string;
  domain: string;
  isSponsor?: boolean;
};

export type RateListing = {
  bankId: string;
  bankName: string;
  domain: string;
  isSponsor: boolean;
  productId: string;
  status: "done" | "error";
  ratePercent?: number; // APY for savings, interest rate for loans
  minAmountVND?: number;
  source: "internal" | "scraped"; // internal = Shinhan's own feed, never scraped
  live: boolean; // true only if a real TinyFish agent produced this specific listing
  checkedAt: string;
};

export type AgentStatus = {
  status: "done" | "error";
  lastSyncedAt: string;
};

export type SweepState = {
  listings: RateListing[];
  lastSweepAt: string | null;
  nextSweepAt: string;
  live: boolean;
  sweepInProgress: boolean;
  agentStatuses: Record<string, AgentStatus>;
};

export type ApplicantProfile = {
  name: string;
  phone: string;
  monthlyIncomeVND: number;
  productId: string;
  amountVND: number;
  tenureMonths: number;
};

// The agent fills out each bank's real application form up to (but never
// past) the final submit step — the person reviews and submits themselves.
// The agent never marks its own work "submitted".
export type ApplicationDraft = {
  id: string;
  bankId: string;
  bankName: string;
  productId: string;
  productName: string;
  applicant: ApplicantProfile;
  ratePercent?: number;
  estimatedMonthly?: number; // for loans: est. monthly payment: for savings: est. monthly interest
  formUrl: string;
  fieldsStaged: { label: string; value: string }[];
  status: "staging" | "ready_to_submit" | "submitted_by_user";
  createdAt: string;
};
