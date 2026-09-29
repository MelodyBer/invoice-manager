import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { googleConfig } from "./providers";
import { unseal, record } from "./security";
import { attachments, MAX_ATTACHMENT_BYTES } from "./gmail-rules";
import type { GmailPart } from "@/types/gmail-import";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export class GmailError extends Error {}
async function readJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  for (let attempt: number = 0; attempt < 2; attempt++) {
    let response: Response;
    try { response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) }); }
    catch { if (attempt === 0) continue; throw new GmailError("לא ניתן להתחבר ל־Gmail. בדקי את החיבור ונסי שוב."); }
    if (response.status === 400 && url === "https://oauth2.googleapis.com/token") throw new GmailError("הרשאת Gmail פגה או בוטלה. חברי את החשבון מחדש במסך החיבורים.");
    if ([401,403].includes(response.status)) throw new GmailError("הרשאת Gmail אינה זמינה. חברי מחדש את החשבון במסך החיבורים.");
    if (response.status === 429) throw new GmailError("Google ביקשה להמתין לפני חיפוש נוסף. נסי שוב בעוד כמה דקות.");
    if (!response.ok) { if (response.status >= 500 && attempt === 0) continue; throw new GmailError("לא ניתן לקרוא את המייל או הקובץ. ייתכן שנמחק או שההרשאה פגה."); }
    const reader = response.body?.getReader();
    if (!reader) throw new GmailError("התקבלה תשובה ריקה מ־Gmail.");
    const chunks: Uint8Array[] = []; let length: number = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length;
      if (length > 32 * 1024 * 1024) { await reader.cancel(); throw new GmailError("המייל גדול מדי לקריאה אוטומטית. העלי את הקובץ ידנית."); }
      chunks.push(chunk.value);
    }
    return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  }
  throw new GmailError("החיבור ל־Gmail לא הושלם.");
}
export async function gmailAccount(supabase: Supabase, userId: string): Promise<{ mailbox: string; token: string }> {
  const { data, error } = await supabase.from("integration_connections").select("account_label, encrypted_credentials").eq("user_id", userId).eq("provider", "gmail").maybeSingle();
  if (error || !data) throw new GmailError("יש לחבר חשבון Gmail במסך החיבורים.");
  const secret = record(JSON.parse(unseal(data.encrypted_credentials, `${userId}:gmail`)));
  if (typeof secret.refreshToken !== "string") throw new GmailError("יש לחבר את Gmail מחדש.");
  const config = googleConfig();
  const token = await readJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: secret.refreshToken, grant_type: "refresh_token" }) });
  if (typeof token.access_token !== "string") throw new GmailError("יש לחבר את Gmail מחדש.");
  return { mailbox: data.account_label.toLowerCase(), token: token.access_token };
}
export async function gmailGet(token: string, path: string): Promise<Record<string, unknown>> {
  return readJson(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } });
}
export async function getMessage(token: string, id: string): Promise<Record<string, unknown>> {
  return gmailGet(token, `messages/${encodeURIComponent(id)}?format=full`);
}
export async function getFile(token: string, messageId: string, partId: string): Promise<{ part: GmailPart; bytes: Buffer }> {
  const message = await getMessage(token, messageId);
  const part = attachments(message.payload).find((candidate: GmailPart) => candidate.partId === partId);
  if (!part) throw new GmailError("הקובץ אינו זמין או אינו נתמך. ניתן להעלות אותו ידנית.");
  let data: unknown = part.data;
  if (part.attachmentId) data = (await gmailGet(token, `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.attachmentId)}`)).data;
  if (typeof data !== "string" || data.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9_=-]*$/.test(data)) throw new GmailError("נתוני הקובץ אינם תקינים.");
  const bytes: Buffer = Buffer.from(data, "base64url");
  if (bytes.length !== part.size) throw new GmailError("הקובץ לא התקבל במלואו. נסי שוב.");
  return { part, bytes };
}
