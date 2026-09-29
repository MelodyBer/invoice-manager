import type { GmailPart } from "@/types/gmail-import";
export const MAX_ATTACHMENT_BYTES: number = 10 * 1024 * 1024;
const supported: readonly string[] = ["application/pdf", "image/jpeg", "image/png"];

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("התקבלה תשובה לא תקינה.");
  return value as Record<string, unknown>;
}
export function dateRange(start: string, end: string): { query: string } {
  const valid = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(start) || !valid(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 365) throw new Error("בחרי טווח תאריכים תקין של עד שנה.");
  // Gmail date literals use Pacific time. Search a padded UTC interval, then filter internalDate in Israel.
  const after: number = Math.floor(Date.parse(start) / 1000) - 86400;
  const before: number = Math.floor(Date.parse(end) / 1000) + 2 * 86400;
  return { query: `has:attachment -in:sent after:${after} before:${before} {filename:pdf filename:png filename:jpg filename:jpeg}` };
}
export function israelReceivedDate(value: unknown): string {
  const timestamp: number = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("תאריך המייל אינו תקין.");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
export function attachments(payload: unknown): GmailPart[] {
  const result: GmailPart[] = [];
  const walk = (value: unknown, depth: number): void => {
    if (depth > 20 || result.length > 100) throw new Error("מבנה המייל גדול מדי לבדיקה אוטומטית.");
    const part = object(value);
    const body = part.body ? object(part.body) : {};
    if (typeof part.filename === "string" && part.filename && typeof part.partId === "string" && typeof part.mimeType === "string" && supported.includes(part.mimeType)) {
      const size: number = Number(body.size);
      if (Number.isSafeInteger(size) && size > 0 && size <= MAX_ATTACHMENT_BYTES) result.push({ partId: part.partId, filename: part.filename.slice(0, 255), mimeType: part.mimeType, size, attachmentId: typeof body.attachmentId === "string" ? body.attachmentId : null, data: typeof body.data === "string" ? body.data : null });
    }
    if (Array.isArray(part.parts)) for (const child of part.parts) walk(child, depth + 1);
  };
  walk(payload, 0);
  return result;
}
function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{M}]/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function near(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 3 || Math.abs(a.length - b.length) > 1) return false;
  let row: number[] = Array.from({ length: b.length + 1 }, (_, index: number) => index);
  for (let i: number = 1; i <= a.length; i++) {
    const next: number[] = [i];
    for (let j: number = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] <= 1;
}
export function matchRecipient(recipient: string | null, confidence: number, names: string[]): "match" | "review" | "ignore" {
  const name: string = normalized(recipient ?? "");
  const aliases: string[] = names.map(normalized).filter(Boolean);
  if (!name || confidence < 0.9) return "review";
  if (aliases.includes(name)) return "match";
  const words: string[] = name.split(" ");
  for (const alias of aliases.filter((value: string) => !value.includes(" "))) {
    if (!words.includes(alias)) continue;
    const fuller: string[] = aliases.filter((value: string) => value.includes(" ") && value.split(" ").includes(alias));
    if (fuller.length > 0 && words.length > 1) return "review";
    return "match";
  }
  return aliases.some((alias: string) => near(alias, name) || (!alias.includes(" ") && words.some((word: string) => near(alias, word)))) ? "review" : "ignore";
}
export function verifyFile(bytes: Uint8Array, mime: string): void {
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) throw new Error("הקובץ חורג מהגודל המותר: עד 10 מגה־בייט.");
  const signature: string = Array.from(bytes.slice(0, 8)).map((value: number) => value.toString(16).padStart(2, "0")).join("");
  const valid: boolean = mime === "application/pdf" ? new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-") : mime === "image/png" ? signature === "89504e470d0a1a0a" : mime === "image/jpeg" && signature.startsWith("ffd8ff");
  if (!valid) throw new Error("תוכן הקובץ אינו תואם לפורמט PDF או תמונה נתמכת.");
}
