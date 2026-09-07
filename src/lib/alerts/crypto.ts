/**
 * AES-256-GCM şifreleme — Gmail uygulama şifreleri sunucu tarafında şifreli saklanır.
 * Anahtar: MAIL_SECRET env değişkeni (yoksa deterministik türetilir).
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.MAIL_SECRET || process.env.NEXTAUTH_SECRET || "bist-ai-terminal-default-secret-2026";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
