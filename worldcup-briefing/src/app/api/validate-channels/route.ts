import { NextRequest, NextResponse } from "next/server";
import { resolveSessionToken } from "@/lib/session";

function buildConfirmation(type: string, name?: string): string {
  const label = name ? `"${name}" ` : "";
  const typeLabel = type === "telegram" ? "Telegram" : type === "discord" ? "Discord" : "Slack";
  return `✅ Your ${label}${typeLabel} channel is now connected to World Cup Briefing. Reels and notifications will arrive here.`;
}

async function validateTelegram(botToken: string, chatId: string, message: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { valid: true };
    }
    const desc = data?.description || `Telegram API returned status ${res.status}`;
    return { valid: false, error: desc };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Telegram validation failed" };
  }
}

async function validateDiscord(webhookUrl: string, message: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (res.status === 204 || res.status === 200) {
      return { valid: true };
    }
    let errorText = `Discord returned status ${res.status}`;
    try {
      const data = await res.json();
      if (data.message) errorText = data.message;
    } catch {}
    return { valid: false, error: errorText };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Discord validation failed" };
  }
}

async function validateSlack(webhookUrl: string, message: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (res.status === 200) {
      const body = await res.text();
      if (body.trim() === "ok") return { valid: true };
      return { valid: false, error: body || "Slack returned non-ok response" };
    }
    let errorText = `Slack returned status ${res.status}`;
    try {
      const data = await res.text();
      if (data) errorText = data;
    } catch {}
    return { valid: false, error: errorText };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Slack validation failed" };
  }
}

export async function POST(request: NextRequest) {
  const session = resolveSessionToken(request.headers.get("x-session-token") || "");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const telegram = body?.telegram as { botToken?: string; chatId?: string; _name?: string } | undefined;
  const discord = body?.discord as { webhookUrl?: string; _name?: string } | undefined;
  const slack = body?.slack as { webhookUrl?: string; _name?: string } | undefined;

  const result: Record<string, { valid: boolean; error?: string }> = {};

  if (telegram?.botToken && telegram?.chatId) {
    const msg = buildConfirmation("telegram", telegram._name);
    result.telegram = await validateTelegram(telegram.botToken, telegram.chatId, msg);
  }

  if (discord?.webhookUrl) {
    const msg = buildConfirmation("discord", discord._name);
    result.discord = await validateDiscord(discord.webhookUrl, msg);
  }

  if (slack?.webhookUrl) {
    const msg = buildConfirmation("slack", slack._name);
    result.slack = await validateSlack(slack.webhookUrl, msg);
  }

  return NextResponse.json(result);
}
