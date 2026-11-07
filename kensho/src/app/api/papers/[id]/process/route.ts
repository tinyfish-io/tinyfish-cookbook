import { NextResponse, after } from "next/server";
import { startProcessing } from "@/server/pipeline";

export const dynamic = "force-dynamic";
// Drawing a paper takes one to three minutes. `after()` keeps the work running once the response
// is sent; on Vercel that is bounded by this function's max duration.
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { restart?: boolean };
  try {
    const { job, done } = await startProcessing(id, { restart: !!body.restart });
    after(() => done);
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
