import { z } from "zod";

/** The fields that can be read out of a posting page — by rules or by the LLM. */
export const extractedSchema = z.object({
  title: z.string().describe("Job title without company name or location suffixes"),
  company: z.string().nullable().describe("Hiring company name"),
  location: z.string().nullable().describe('Primary location(s), e.g. "New York, NY" or "Remote - US"'),
  workplace: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  seniority: z.enum(["internship", "new_grad", "other"]).describe("internship/co-op, new grad/entry level, or other"),
  term: z.string().nullable().describe('Internship term if stated, e.g. "Summer 2027"'),
  gradYears: z.array(z.number().int()).describe("Graduation years the posting targets, e.g. [2027, 2028]"),
  pay: z.string().nullable().describe('Pay as stated, e.g. "$57/hr" or "$9,000–$10,000/month"'),
  visa: z
    .enum(["sponsors", "no_sponsorship", "unknown"])
    .describe("Whether the posting says it sponsors work visas; unknown if not stated"),
  skills: z.array(z.string()).describe("Up to 8 concrete technical skills the posting asks for"),
  summary: z.string().nullable().describe("One sentence on what the role actually does"),
});

export type Extracted = z.infer<typeof extractedSchema>;

export interface Job extends Extracted {
  id: string;
  applyUrl: string;
  ats: string;
  foundBy: "search" | "board" | "agent";
  readBy: "fetch" | "firecrawl" | "agent";
  extractedBy: "rules" | "llm";
  fetchedAt: string;
}

/** Stable id from the posting URL (ignores query string, trailing slash, http/https). */
export function jobId(url: string): string {
  let key = url;
  try {
    const u = new URL(url);
    key = (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {}
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
