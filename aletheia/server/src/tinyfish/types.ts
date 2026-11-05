import { z } from "zod";

const stepRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  status: z.string(),
  action: z.string().nullable(),
  screenshot: z.string().nullable(),
  html: z.string().nullish(),
  duration: z.string().nullable().optional(),
});

const runErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  category: z.string().optional(),
});

const runRecordSchema = z.object({
  run_id: z.string(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  num_of_steps: z.number().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: runErrorSchema.nullable(),
  streaming_url: z.string().nullable(),
  // Older run records have no steps array.
  steps: z.array(stepRecordSchema).default([]),
});

export type StepRecord = z.infer<typeof stepRecordSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;

export function parseRunRecord(raw: unknown): RunRecord {
  return runRecordSchema.parse(raw);
}

const TERMINAL_STATUSES: ReadonlySet<RunRecord["status"]> = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export function isTerminal(status: RunRecord["status"]): boolean {
  return TERMINAL_STATUSES.has(status);
}
