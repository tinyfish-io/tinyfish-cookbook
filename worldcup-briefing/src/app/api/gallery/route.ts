import { and, desc, eq, or, sql, count, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, runs } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || "";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "15", 10) || 15));
  const offset = (page - 1) * limit;

  try {
    const conditions = [eq(runs.isPublic, true), eq(runs.status, "completed")];
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
          playerUrl: runs.playerUrl,
          thumbnailUrl: runs.thumbnailUrl,
          summary: runs.summary,
          events: runs.events,
          selectedVideo: runs.selectedVideo,
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
        player_url: row.playerUrl,
        thumbnail_url: row.thumbnailUrl,
        summary: row.summary,
        events: row.events,
        selected_video: row.selectedVideo,
        created_at: row.createdAt?.toISOString() ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error({ err: error }, "Gallery API error");
    return NextResponse.json({ runs: [], total: 0, page, totalPages: 0 }, { status: 500 });
  }
}
