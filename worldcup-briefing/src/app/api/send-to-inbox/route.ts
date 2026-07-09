import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { channels, db, runs } from "@/lib/db";
import { getApiKeyHashes } from "@/lib/session";
import { decryptJson } from "@/lib/encrypt";
import { sendRunNotification } from "@/lib/notify";
import { logger } from "@/lib/logger";
import type { BriefingEvent } from "@/lib/demo-data";

export async function POST(request: NextRequest) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const runId = typeof body?.runId === "string" ? body.runId : "";
  const channelIds = Array.isArray(body?.channelIds) ? (body.channelIds as string[]) : [];

  if (!runId || channelIds.length === 0) {
    return NextResponse.json({ error: "runId and channelIds are required" }, { status: 400 });
  }

  const [run] = await db
    .select({
      id: runs.id,
      query: runs.query,
      topic: runs.topic,
      status: runs.status,
      playerUrl: runs.playerUrl,
      events: runs.events,
      summary: runs.summary,
      thumbnailUrl: runs.thumbnailUrl,
      apiKeyHash: runs.apiKeyHash,
    })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);

  if (!run || !run.apiKeyHash || !hashes.includes(run.apiKeyHash)) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "completed" || !run.playerUrl) {
    return NextResponse.json({ error: "Run is not ready to send" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: channels.id,
      name: channels.name,
      type: channels.type,
      credentialsEnc: channels.credentialsEnc,
    })
    .from(channels)
    .where(and(
      inArray(channels.id, channelIds),
      inArray(channels.apiKeyHash, hashes),
    ));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid inboxes found for this run" }, { status: 404 });
  }

  const runData = {
    runId: run.id,
    query: run.query,
    topic: run.topic,
    playerUrl: run.playerUrl ?? "",
    events: (run.events as BriefingEvent[]) ?? [],
    summary: run.summary,
    thumbnailUrl: run.thumbnailUrl,
  };

  const results: Record<string, { name: string; type: string; success: boolean; error?: string }> = {};

  for (const ch of rows) {
    try {
      const credentials = decryptJson<Record<string, unknown>>(ch.credentialsEnc);

      const config: { telegram?: { botToken: string; chatId: string }; discord?: { webhookUrl: string }; slack?: { webhookUrl: string } } = {};

      if (ch.type === "telegram" && typeof credentials.botToken === "string" && typeof credentials.chatId === "string") {
        config.telegram = { botToken: credentials.botToken, chatId: credentials.chatId };
      } else if (ch.type === "discord" && typeof credentials.webhookUrl === "string") {
        config.discord = { webhookUrl: credentials.webhookUrl };
      } else if (ch.type === "slack" && typeof credentials.webhookUrl === "string") {
        config.slack = { webhookUrl: credentials.webhookUrl };
      }

      await sendRunNotification(config, runData);
      results[ch.id] = { name: ch.name, type: ch.type, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Delivery failed";
      logger.error({ err, channelId: ch.id, channelType: ch.type }, "Send-to-inbox delivery failed");
      results[ch.id] = { name: ch.name, type: ch.type, success: false, error: errorMsg };
    }
  }

  return NextResponse.json({ results });
}
