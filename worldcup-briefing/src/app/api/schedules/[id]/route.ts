import { and, desc, eq, count, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { channels, db, runs, schedules } from "@/lib/db";
import { decryptJson } from "@/lib/encrypt";
import { notifyScheduleChange } from "@/lib/notify";
import { getApiKeyHashes } from "@/lib/session";
import { computeNextRunAt } from "@/lib/timezone";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), inArray(schedules.apiKeyHash, hashes)))
      .limit(1);

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "15", 10) || 15));
    const offset = (page - 1) * limit;

    const where = eq(runs.scheduleId, id);

    const [totalResult, scheduleRuns] = await Promise.all([
      db.select({ count: count() }).from(runs).where(where),
      db
        .select({
          id: runs.id,
          query: runs.query,
          topic: runs.topic,
          status: runs.status,
          playerUrl: runs.playerUrl,
          thumbnailUrl: runs.thumbnailUrl,
          events: runs.events,
          summary: runs.summary,
          selectedVideo: runs.selectedVideo,
          errorMessage: runs.errorMessage,
          createdAt: runs.createdAt,
          completedAt: runs.completedAt,
        })
        .from(runs)
        .where(where)
        .orderBy(desc(runs.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        query: schedule.query,
        runTime: schedule.runTime,
        timezone: schedule.timezone,
        channel: schedule.channel,
        isActive: schedule.isActive,
        nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
        lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
        createdAt: schedule.createdAt?.toISOString() ?? null,
      },
      runs: scheduleRuns.map((row) => ({
        id: row.id,
        query: row.query,
        topic: row.topic,
        status: row.status,
        player_url: row.playerUrl,
        thumbnail_url: row.thumbnailUrl,
        events: row.events,
        summary: row.summary,
        selected_video: row.selectedVideo,
        error_message: row.errorMessage,
        created_at: row.createdAt?.toISOString() ?? null,
        completed_at: row.completedAt?.toISOString() ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error({ err: error }, "Schedule GET error");
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasToggle = typeof body.isActive === "boolean";
  const hasFields = typeof body.query === "string" || typeof body.runTime === "string" || typeof body.timezone === "string" || Array.isArray(body.channelIds);

  if (!hasToggle && !hasFields) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select({
        id: schedules.id,
        apiKeyHash: schedules.apiKeyHash,
        query: schedules.query,
        runTime: schedules.runTime,
        timezone: schedules.timezone,
        channelConfig: schedules.channelConfig,
      })
      .from(schedules)
      .where(eq(schedules.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (!existing.apiKeyHash || !hashes.includes(existing.apiKeyHash)) {
      return NextResponse.json({ error: "Not authorized to modify this schedule" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (hasToggle) {
      updateData.isActive = body.isActive;
    }

    if (typeof body.query === "string" && body.query.trim()) {
      updateData.query = body.query.trim();
    }
    if (typeof body.runTime === "string" && /^\d{2}:\d{2}$/.test(body.runTime)) {
      updateData.runTime = body.runTime;
    }
    if (typeof body.timezone === "string" && body.timezone.trim()) {
      updateData.timezone = body.timezone;
    }
    if (Array.isArray(body.channelIds)) {
      const newChannelIds = body.channelIds.filter((id: unknown) => typeof id === "string") as string[];
      updateData.channelConfig = { channelIds: newChannelIds };

      const channelRows = await db
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(inArray(channels.apiKeyHash, hashes));

      const channelMap = new Map(channelRows.map((c) => [c.id, c.type]));
      updateData.channel = newChannelIds.map((cid) => channelMap.get(cid)).filter(Boolean).join(",") || "none";
    }

    const effectiveRunTime = (updateData.runTime as string) || existing.runTime;
    const effectiveTimezone = (updateData.timezone as string) || existing.timezone;

    if (updateData.isActive !== false) {
      const stillActive = updateData.isActive === true || (existing.channelConfig && !hasToggle);
      if (stillActive) {
        updateData.nextRunAt = computeNextRunAt(effectiveRunTime, effectiveTimezone);
      }
    }

    await db.update(schedules).set(updateData).where(eq(schedules.id, id));

    if (hasToggle || hasFields) {
      const oldCfg = existing.channelConfig as { channelIds?: string[] };
      const oldIds = Array.isArray(oldCfg?.channelIds) ? oldCfg.channelIds : [];
      const newIds = Array.isArray(body.channelIds)
        ? (body.channelIds as string[]).filter((id: unknown) => typeof id === "string")
        : oldIds;
      const removedIds = oldIds.filter((id) => !newIds.includes(id));

      const allChannelRows = await db
        .select({ id: channels.id, type: channels.type, credentialsEnc: channels.credentialsEnc })
        .from(channels)
        .where(inArray(channels.apiKeyHash, hashes));

      const channelCreds = new Map<string, Record<string, unknown>>();
      for (const c of allChannelRows) {
        try { channelCreds.set(c.id, decryptJson(c.credentialsEnc)); } catch {}
      }

      const effectiveRunTime = (updateData.runTime as string) || existing.runTime;
      const effectiveTimezone = (updateData.timezone as string) || existing.timezone;
      const action: "created" | "paused" | "resumed" | "updated" = hasToggle ? (body.isActive ? "resumed" : "paused") : "updated";

      if (newIds.length > 0) {
        const notifyConfig: { telegram?: { botToken: string; chatId: string }; discord?: { webhookUrl: string }; slack?: { webhookUrl: string } } = {};
        for (const cid of newIds) {
          const ch = allChannelRows.find((c) => c.id === cid);
          if (!ch) continue;
          const c = channelCreds.get(cid);
          if (!c) continue;
          if (ch.type === "telegram" && c.botToken && c.chatId) notifyConfig.telegram = { botToken: c.botToken as string, chatId: c.chatId as string };
          if (ch.type === "discord" && c.webhookUrl) notifyConfig.discord = { webhookUrl: c.webhookUrl as string };
          if (ch.type === "slack" && c.webhookUrl) notifyConfig.slack = { webhookUrl: c.webhookUrl as string };
        }
        notifyScheduleChange(notifyConfig, {
          query: (updateData.query as string) || existing.query,
          runTime: effectiveRunTime,
          timezone: effectiveTimezone,
          action,
        }).catch(() => {});
      }

      for (const removedId of removedIds) {
        const ch = allChannelRows.find((c) => c.id === removedId);
        if (!ch) continue;
        const c = channelCreds.get(removedId);
        if (!c) continue;
        const removedConfig: { telegram?: { botToken: string; chatId: string }; discord?: { webhookUrl: string }; slack?: { webhookUrl: string } } = {};
        if (ch.type === "telegram" && c.botToken && c.chatId) removedConfig.telegram = { botToken: c.botToken as string, chatId: c.chatId as string };
        if (ch.type === "discord" && c.webhookUrl) removedConfig.discord = { webhookUrl: c.webhookUrl as string };
        if (ch.type === "slack" && c.webhookUrl) removedConfig.slack = { webhookUrl: c.webhookUrl as string };
        notifyScheduleChange(removedConfig, {
          query: existing.query,
          runTime: effectiveRunTime,
          timezone: effectiveTimezone,
          action: "removed",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Schedules PATCH error");
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const [existing] = await db
      .select({ id: schedules.id, apiKeyHash: schedules.apiKeyHash })
      .from(schedules)
      .where(eq(schedules.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (!existing.apiKeyHash || !hashes.includes(existing.apiKeyHash)) {
      return NextResponse.json({ error: "Not authorized to delete this schedule" }, { status: 403 });
    }

    await db.delete(schedules).where(eq(schedules.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Schedules DELETE error");
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
