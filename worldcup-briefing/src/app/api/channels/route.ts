import { desc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { channels, db } from "@/lib/db";
import { getApiKeyHashes } from "@/lib/session";
import { encryptJson } from "@/lib/encrypt";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id: channels.id,
        name: channels.name,
        type: channels.type,
        isValidated: channels.isValidated,
        lastValidatedAt: channels.lastValidatedAt,
        createdAt: channels.createdAt,
      })
      .from(channels)
      .where(inArray(channels.apiKeyHash, hashes))
      .orderBy(desc(channels.createdAt))
      .limit(50);

    return NextResponse.json({
      channels: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        isValidated: row.isValidated,
        lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
        createdAt: row.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Channels GET error");
    return NextResponse.json({ channels: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const hashes = await getApiKeyHashes(request.headers);
  if (hashes.length === 0) {
    return NextResponse.json({ error: "Missing x-vdb-key-hash or x-session-token header" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "";
  const credentials = typeof body?.credentials === "object" && !Array.isArray(body?.credentials) && body.credentials
    ? body.credentials as Record<string, unknown>
    : null;

  if (!name || (type !== "telegram" && type !== "discord" && type !== "slack") || !credentials) {
    return NextResponse.json({ error: "Missing required fields: name, type, credentials" }, { status: 400 });
  }

  try {
    const isValidated = body?.isValidated === true;

    const [inserted] = await db
      .insert(channels)
      .values({
        name,
        type,
        credentialsEnc: encryptJson(credentials),
        apiKeyHash: hashes[0],
        isValidated,
        lastValidatedAt: isValidated ? new Date() : null,
      })
      .returning({ id: channels.id });

    return NextResponse.json({ channelId: inserted.id });
  } catch (error) {
    logger.error({ err: error }, "Channels POST error");
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }
}
