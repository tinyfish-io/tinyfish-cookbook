import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, runs } from "@/lib/db";
import { getApiKeyHashes, resolveSessionToken } from "@/lib/session";
import { logger } from "@/lib/logger";
import type { BriefingEvent } from "@/lib/demo-data";

const TIMEOUT_MINUTES = 15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  try {
    const rows = await db
      .select({
        id: runs.id,
        query: runs.query,
        topic: runs.topic,
        status: runs.status,
        mode: runs.mode,
        isPublic: runs.isPublic,
        apiKeyHash: runs.apiKeyHash,
        selectedVideo: runs.selectedVideo,
        playerUrl: runs.playerUrl,
        streamUrl: runs.streamUrl,
        thumbnailUrl: runs.thumbnailUrl,
        events: runs.events,
        timeline: runs.timeline,
        summary: runs.summary,
        statusMessage: runs.statusMessage,
        statusHistory: runs.statusHistory,
        errorMessage: runs.errorMessage,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
      })
      .from(runs)
      .where(sql`${runs.id}::text = ${runId}`)
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const row = rows[0];

    if (!row.isPublic && row.status !== "completed") {
      const sessionToken = request.headers.get("x-session-token");
      if (!sessionToken) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      const session = resolveSessionToken(sessionToken);
      if (!session) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      const hashes = await getApiKeyHashes(request.headers);
      if (!row.apiKeyHash || !hashes.includes(row.apiKeyHash)) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
    }

    if (row.status === "processing" && row.createdAt) {
      const elapsed = Date.now() - row.createdAt.getTime();
      if (elapsed > TIMEOUT_MINUTES * 60 * 1000) {
        await db.update(runs).set({
          status: "failed",
          errorMessage: `Timed out after ${TIMEOUT_MINUTES} minutes`,
          statusMessage: "Timed out",
          completedAt: new Date(),
        }).where(eq(runs.id, runId));
        return NextResponse.json({
          runId: row.id,
          query: row.query,
          topic: row.topic ?? undefined,
          status: "failed",
          mode: row.mode ?? undefined,
          selectedVideo: row.selectedVideo ?? undefined,
          playerUrl: row.playerUrl ?? undefined,
          streamUrl: row.streamUrl ?? undefined,
          thumbnailUrl: row.thumbnailUrl ?? undefined,
          events: (row.events as BriefingEvent[]) ?? undefined,
      timeline: (row.timeline as Record<string, unknown>[]) ?? undefined,
      summary: row.summary ?? undefined,
      statusMessage: "Timed out",
      statusHistory: (row.statusHistory as Array<{ ts: string; msg: string }>) ?? undefined,
      errorMessage: `Timed out after ${TIMEOUT_MINUTES} minutes`,
          createdAt: row.createdAt?.toISOString() ?? undefined,
          completedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      runId: row.id,
      query: row.query,
      topic: row.topic ?? undefined,
      status: row.status,
      mode: row.mode ?? undefined,
      selectedVideo: row.selectedVideo ?? undefined,
      playerUrl: row.playerUrl ?? undefined,
      streamUrl: row.streamUrl ?? undefined,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
      events: (row.events as BriefingEvent[]) ?? undefined,
      timeline: (row.timeline as Record<string, unknown>[]) ?? undefined,
      summary: row.summary ?? undefined,
      statusMessage: row.statusMessage ?? undefined,
      statusHistory: (row.statusHistory as Array<{ ts: string; msg: string }>) ?? undefined,
      errorMessage: row.errorMessage ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? undefined,
      completedAt: row.completedAt?.toISOString() ?? undefined,
    });
  } catch (error) {
    logger.error({ err: error }, "Run status API error");
    return NextResponse.json({ error: "Failed to fetch run status" }, { status: 500 });
  }
}
