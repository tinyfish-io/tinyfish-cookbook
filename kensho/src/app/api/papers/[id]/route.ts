import { NextResponse } from "next/server";
import { getState } from "@/server/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = getState(id);
  if (!state) return NextResponse.json({ error: "Paper not found. Search for it first." }, { status: 404 });
  // Full text stays on the server: the client gets section headings plus the short verified
  // quotes inside claims, never the copyrighted body.
  const acquisition = state.acquisition && {
    ...state.acquisition,
    sections: state.acquisition.sections.map((s) => ({ id: s.id, heading: s.heading, text: "" })),
  };
  return NextResponse.json({ ...state, acquisition });
}
