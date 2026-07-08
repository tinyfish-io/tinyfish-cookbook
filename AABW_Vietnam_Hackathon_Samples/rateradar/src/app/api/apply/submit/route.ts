import { NextRequest, NextResponse } from "next/server";
import { markSubmitted } from "@/lib/sweep";

export const dynamic = "force-dynamic";

// Marks a draft as submitted-by-the-user. The agent never calls this
// itself — only a person clicking "I submitted this" in the UI does,
// after reviewing on the bank's own site.
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  await markSubmitted(id);
  return NextResponse.json({ ok: true });
}
