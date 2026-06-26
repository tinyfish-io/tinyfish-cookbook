import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, runs } from "@/lib/db";
import { logger } from "@/lib/logger";

function checkAdmin(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = checkAdmin(request);
  if (auth) return auth;

  try {
    const rows = await db
      .select({
        id: runs.id,
        query: runs.query,
        topic: runs.topic,
        playerUrl: runs.playerUrl,
        thumbnailUrl: runs.thumbnailUrl,
        summary: runs.summary,
        events: runs.events,
        selectedVideo: runs.selectedVideo,
        isPublic: runs.isPublic,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .where(eq(runs.status, "completed"))
      .orderBy(desc(runs.createdAt))
      .limit(50);

    return NextResponse.json({
      runs: rows.map((row) => ({
        id: row.id,
        query: row.query,
        topic: row.topic,
        player_url: row.playerUrl,
        thumbnail_url: row.thumbnailUrl,
        summary: row.summary,
        events: row.events,
        selected_video: row.selectedVideo,
        is_public: row.isPublic,
        created_at: row.createdAt?.toISOString() ?? null,
      })),
      total: rows.length,
    });
  } catch (error) {
    logger.error({ err: error }, "Admin runs API error");
    return NextResponse.json({ runs: [], total: 0 }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = checkAdmin(request);
  if (auth) return auth;

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
    const result = await db
      .update(runs)
      .set({ isPublic: false })
      .where(eq(runs.id, body.runId));
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, runId: body.runId, action: "unseeded" });
  } catch (error) {
    logger.error({ err: error }, "Admin unseed run error");
    return NextResponse.json({ error: "Failed to unseed run" }, { status: 500 });
  }
}
