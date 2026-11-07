import { NextResponse } from "next/server";
import { startProcessing } from "@/server/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { restart?: boolean };
  try {
    return NextResponse.json({ job: startProcessing(id, { restart: !!body.restart }) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
