import { createHash } from "crypto";
import { decrypt, encrypt } from "@/lib/encrypt";
import { db, userKeys } from "@/lib/db";
import { eq } from "drizzle-orm";

type SessionPayload = {
  tf: string;
  vdb: string;
  uid?: string;
  exp: number;
};

const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function createSessionToken(tfApiKey: string, vdbApiKey: string, userId?: string): string {
  const payload: SessionPayload = {
    tf: tfApiKey,
    vdb: vdbApiKey,
    exp: Date.now() + TOKEN_TTL,
  };
  if (userId) payload.uid = userId;
  return encrypt(JSON.stringify(payload));
}

export function resolveSessionToken(token: string): { tfApiKey: string; vdbApiKey: string; apiKeyHash: string; userId?: string } | null {
  try {
    const raw = decrypt(token);
    const payload = JSON.parse(raw) as SessionPayload;
    if (!payload.tf || !payload.vdb) return null;
    if (Date.now() > payload.exp) return null;
    const apiKeyHash = createHash("sha256").update(payload.vdb).digest("hex");
    return { tfApiKey: payload.tf, vdbApiKey: payload.vdb, apiKeyHash, userId: payload.uid };
  } catch {
    return null;
  }
}

export async function resolveApiKeyHashes(token: string): Promise<string[]> {
  const session = resolveSessionToken(token);
  if (!session) return [];
  if (!session.userId) return [session.apiKeyHash];
  try {
    const rows = await db
      .select({ apiKeyHash: userKeys.apiKeyHash })
      .from(userKeys)
      .where(eq(userKeys.userId, session.userId));
    if (rows.length === 0) return [session.apiKeyHash];
    return rows.map((r) => r.apiKeyHash);
  } catch {
    return [session.apiKeyHash];
  }
}

export async function getApiKeyHashes(headers: Headers): Promise<string[]> {
  const directHash = headers.get("x-vdb-key-hash");
  if (directHash) return [directHash];
  const token = headers.get("x-session-token");
  if (token) return resolveApiKeyHashes(token);
  return [];
}
