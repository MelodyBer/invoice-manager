import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "node:crypto";

export interface OAuthAttempt {
  userId: string;
  state: string;
  verifier: string;
  issuedAt: number;
}

function encryptionKey(): Buffer {
  const value: string = process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("נדרשת הגדרת הצפנה לחיבורים בשרת.");
  return Buffer.from(value, "hex");
}

export function encryptionReady(): boolean {
  return /^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "");
}

// Bind every secret to its owner and purpose. Call only from server modules.
export function seal(value: string, context: string): string {
  const iv: Buffer = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted: Buffer = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function unseal(value: string, context: string): string {
  const parts: string[] = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("פרטי החיבור אינם תקינים. יש לחבר מחדש.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parts[1], "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}

export function newOAuthAttempt(userId: string): OAuthAttempt {
  return { userId, state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"), issuedAt: Date.now() };
}

export function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("התקבלה תשובה לא תקינה מהשירות.");
  return value as Record<string, unknown>;
}

export function validateAttempt(raw: string, userId: string, state: string, now: number = Date.now()): OAuthAttempt {
  const value: Record<string, unknown> = record(JSON.parse(unseal(raw, `${userId}:gmail-oauth`)));
  if (value.userId !== userId || typeof value.state !== "string" || typeof value.verifier !== "string" || typeof value.issuedAt !== "number") throw new Error("בקשת החיבור אינה תקינה.");
  const expected: Buffer = Buffer.from(value.state);
  const received: Buffer = Buffer.from(state);
  if (expected.length !== received.length || !timingSafeEqual(expected, received) || now - value.issuedAt > 600_000 || now < value.issuedAt) throw new Error("בקשת החיבור פגה. התחילי מחדש.");
  return { userId, state: value.state, verifier: value.verifier, issuedAt: value.issuedAt };
}

export function parseNames(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 1800) throw new Error("הזיני עד 20 שמות, כל שם בשורה נפרדת.");
  const names: string[] = [...new Set(value.split(/\r?\n/).map((name: string) => name.trim().normalize("NFKC")).filter(Boolean))];
  if (names.length > 20 || names.some((name: string) => name.length < 2 || name.length > 80 || /[\p{Cc}\p{Cf}]/u.test(name))) throw new Error("כל שם צריך לכלול בין 2 ל־80 תווים, ללא תווי בקרה; עד 20 שמות.");
  return names;
}
