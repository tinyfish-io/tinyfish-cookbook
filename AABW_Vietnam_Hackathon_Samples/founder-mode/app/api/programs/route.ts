import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded, bootstrapLocalDevIfNeeded } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  bootstrapLocalDevIfNeeded();
  const programs = await store.getPrograms();
  return NextResponse.json({ programs });
}
