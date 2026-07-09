import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, runs } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { runId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  try {
    await db
      .update(runs)
      .set({ isPublic: true })
      .where(eq(runs.id, body.runId));
  } catch (error) {
    logger.error({ err: error }, "Admin seed error");
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, runId: body.runId });
}
