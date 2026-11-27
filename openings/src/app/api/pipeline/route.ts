import { z } from "zod";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

const list = (max: number) => z.array(z.string().trim().min(1).max(60)).max(max);

const bodySchema = z.object({
  role: z.string().trim().min(2).max(80),
  locations: list(3),
  seniority: z.enum(["internship", "new_grad", "any"]),
  companies: list(10).default([]),
  keywords: list(5).default([]),
  needsVisa: z.boolean().default(false),
  gradYear: z.number().int().min(2024).max(2035).nullable().default(null),
  readLimit: z.number().int().min(1).max(30).default(15),
  agentRuns: z.number().int().min(0).max(4).default(0),
});

/** Dev endpoint behind the /progress dashboard: runs the full pipeline and returns jobs + stats. */
export async function POST(request: Request) {
  // Dev tool behind /progress: no guard on it, so it's off in production.
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  const { readLimit, agentRuns, ...rest } = parsed.data;

  try {
    const result = await runPipeline(rest, { readLimit, agentRuns });
    return Response.json(result);
  } catch (err) {
    console.error("[pipeline]", err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
