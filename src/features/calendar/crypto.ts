import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const value = Buffer.from(process.env.CALENDAR_TOKEN_KEY ?? "", "base64");
  if (value.length !== 32)
    throw new Error("ยังไม่ได้ตั้งค่าการเข้ารหัส Calendar");
  return value;
}
export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export function encryptTokens(tokens: GoogleTokens): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptTokens(value: string): GoogleTokens {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw new Error("กรุณาเชื่อม Calendar ใหม่");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as GoogleTokens;
}
