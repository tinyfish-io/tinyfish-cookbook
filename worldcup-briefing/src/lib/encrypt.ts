import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveSecret(): Buffer {
  const raw = process.env.ENCRYPTION_SECRET;
  if (!raw) throw new Error("ENCRYPTION_SECRET is not configured");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext: string, secret?: string): string {
  const key = secret ? createHash("sha256").update(secret).digest() : deriveSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string, secret?: string): string {
  const key = secret ? createHash("sha256").update(secret).digest() : deriveSecret();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex) throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function encryptJson(value: Record<string, unknown>): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T;
}
