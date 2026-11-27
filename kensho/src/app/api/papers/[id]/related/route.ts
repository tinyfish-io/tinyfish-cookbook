import { NextResponse } from "next/server";
import { getPaper } from "@/server/db";
import { related } from "@/server/discovery";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await getPaper(id);
  if (!paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  try {
    return NextResponse.json({ papers: await related(paper) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, papers: [] }, { status: 502 });
  }
}
