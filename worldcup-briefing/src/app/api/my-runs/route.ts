import { and, desc, eq, isNull, ne, or, sql, count, type SQL, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, runs } from "@/lib/db";
import { getApiKeyHashes } from "@/lib/session";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() || "";
  const status = request.nextUrl.searchParams.get("status")?.trim() || "";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "15", 10) || 15));
  const offset = (page - 1) * limit;

  try {
    const conditions: SQL[] = [
      inArray(runs.apiKeyHash, hashes),
      isNull(runs.scheduleId),
    ];

    if (status === "failed") {
      conditions.push(eq(runs.status, "failed"));
    } else {
      conditions.push(ne(runs.status, "failed"));
    }

    if (search) {
      conditions.push(or(
        sql`${runs.query} ILIKE ${`%${search}%`}`,
        sql`${runs.topic} ILIKE ${`%${search}%`}`,
        sql`${runs.summary} ILIKE ${`%${search}%`}`,
      ) as SQL);
    }

    const where = and(...conditions);

    const [totalResult, rows] = await Promise.all([
      db.select({ count: count() }).from(runs).where(where),
      db
        .select({
          id: runs.id,
          query: runs.query,
          topic: runs.topic,
          status: runs.status,
          playerUrl: runs.playerUrl,
          thumbnailUrl: runs.thumbnailUrl,
          summary: runs.summary,
          events: runs.events,
          selectedVideo: runs.selectedVideo,
          errorMessage: runs.errorMessage,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(where)
        .orderBy(desc(runs.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json({
      runs: rows.map((row) => ({
        id: row.id,
        query: row.query,
        topic: row.topic,
        status: row.status,
        player_url: row.playerUrl,
        thumbnail_url: row.thumbnailUrl,
        summary: row.summary,
        events: row.events,
        selected_video: row.selectedVideo,
        error_message: row.errorMessage,
        created_at: row.createdAt?.toISOString() ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error({ err: error }, "My runs API error");
    return NextResponse.json({ runs: [], total: 0, page, totalPages: 0 }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId query parameter" }, { status: 400 });
  }

  try {
    const found = await db
      .select({ id: runs.id, apiKeyHash: runs.apiKeyHash })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (!found.length) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (!found[0].apiKeyHash || !hashes.includes(found[0].apiKeyHash)) {
      return NextResponse.json({ error: "Not authorized to delete this run" }, { status: 403 });
    }

    await db.delete(runs).where(eq(runs.id, runId));
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "My runs DELETE error");
    return NextResponse.json({ error: "Failed to delete run" }, { status: 500 });
  }
}
