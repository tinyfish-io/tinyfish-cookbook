import { z } from "zod";
import type { PipelineResult, Stage } from "./pipeline";
import type { AgentEvent } from "./agent";

const list = (max: number) => z.array(z.string().trim().min(1).max(60)).max(max);

export const runRequestSchema = z.object({
  role: z.string().trim().min(2).max(80),
  locations: list(3),
  seniority: z.enum(["internship", "new_grad", "any"]),
  companies: list(10).default([]),
  keywords: list(5).default([]),
  needsVisa: z.boolean().default(false),
  gradYear: z.number().int().min(2024).max(2035).nullable().default(null),
  agentRuns: z.number().int().min(0).max(4).default(0),
  /** Deep search passcode (required for agentRuns > 0 in production; see guard.ts). */
  passcode: z.string().max(200).optional(),
});

/** One line of the NDJSON stream the jobs dashboard reads. */
export type RunEvent =
  | { type: "progress"; stage: Stage; message: string; done: boolean; at: number }
  | { type: "agent"; event: AgentEvent; at: number }
  | { type: "result"; result: PipelineResult }
  | { type: "error"; message: string };

export type RunRequest = z.input<typeof runRequestSchema>;
