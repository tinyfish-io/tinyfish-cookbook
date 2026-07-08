export interface SiteInfo {
  id: string;
  name: string;
  url: string;
  kind: "aggregator" | "accelerator" | "government";
  hasPortfolio: boolean;
}

export interface AgentStatus {
  siteId: string;
  status: "done" | "error";
  lastSyncedAt: string | null;
  programsFound: number;
}

export type ProgramType = "Accelerator" | "Grant" | "VC Residency";

export interface Program {
  id: string;
  name: string;
  type: ProgramType;
  location: string;
  url: string;
  applyUrl: string;
  fundingSummary: string;
  deadline: string | null; // ISO date, null if rolling
  matchScore: number; // 0-100, heuristic fit against company profile
  foundAt: string;
  source: "seed" | "real";
}

export type ApplicationStage = "discovered" | "extracting" | "drafting" | "ready" | "submitted";

export interface QuestionAnswer {
  id: string;
  question: string;
  charLimit: number | null;
  draft: string;
  edited: boolean;
}

export interface Application {
  id: string;
  programId: string;
  programName: string;
  stage: ApplicationStage;
  statusNote: string;
  questions: QuestionAnswer[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface Founder {
  name: string;
  role: string;
  bio: string;
}

export interface CompanyProfile {
  name: string;
  pitch: string;
  sector: string;
  stage: string;
  website: string;
  tractionSummary: string;
  founders: Founder[];
}

export interface ScheduleMeta {
  lastDiscoveryAt: string | null;
  discoveryStartedAt: string | null;
  discoveryIntervalMs: number;
  usingRealAgents: boolean;
  lastDispatchedAt: string | null;
}
