import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import type { GmailImportRow, ImportView } from "@/types/gmail-import";
import { attachments, dateRange, israelReceivedDate, matchRecipient, object, verifyFile } from "./gmail-rules";
import { gmailAccount, gmailGet, getMessage, getFile, GmailError } from "./gmail-api";
import { recognizeAttachment } from "./gmail-recognition";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export const VIEW_COLUMNS = "id,file_name,received_on,state,recipient_name,reason,document_id";
export function safeImportError(error: unknown): string {
  return error instanceof GmailError ? error.message : "הפעולה לא הושלמה. בדקי את החיבור ונסי שוב; אפשר גם להעלות את הקובץ ידנית.";
}
async function settings(supabase: Supabase, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("integration_settings").select("recognition_names").eq("user_id", userId).maybeSingle();
  if (error || !data?.recognition_names.length) throw new GmailError("לפני החיפוש, שמרי לפחות שם אחד לזיהוי במסך החיבורים.");
  return data.recognition_names;
}
export async function discover(supabase: Supabase, userId: string, start: string, end: string, pageToken: string | null): Promise<{ next: string | null; ids: string[]; searched: number }> {
  let query: string;
  try { query = dateRange(start, end).query; } catch { throw new GmailError("בחרי טווח תאריכים תקין של עד שנה."); }
  if (pageToken && (pageToken.length > 2048 || /[\r\n]/.test(pageToken))) throw new GmailError("יש להתחיל את החיפוש מחדש.");
  await settings(supabase, userId);
  const account = await gmailAccount(supabase, userId);
  const params = new URLSearchParams({ q: query, maxResults: "5", includeSpamTrash: "false" });
  if (pageToken) params.set("pageToken", pageToken);
  const response = await gmailGet(account.token, `messages?${params.toString()}`);
  const messages: unknown[] = Array.isArray(response.messages) ? response.messages : [];
  const ids: string[] = [];
  for (const entry of messages) {
    const id: unknown = object(entry).id;
    if (typeof id !== "string") throw new GmailError("התקבלה רשימת מיילים לא תקינה.");
    const message = await getMessage(account.token, id);
    const received: string = israelReceivedDate(message.internalDate);
    if (received < start || received > end) continue;
    for (const part of attachments(message.payload)) {
      const row = { user_id: userId, mailbox: account.mailbox, message_id: id, part_id: part.partId, file_name: part.filename, mime_type: part.mimeType, file_size: part.size, received_on: received };
      const { error } = await supabase.from("gmail_import_items").upsert(row, { onConflict: "user_id,mailbox,message_id,part_id", ignoreDuplicates: true });
      if (error) throw new GmailError("לא ניתן לשמור את תור הייבוא. ודאי שהרצת את עדכון מסד הנתונים.");
      const { data, error: readError } = await supabase.from("gmail_import_items").select("id,state").eq("user_id", userId).eq("mailbox", account.mailbox).eq("message_id", id).eq("part_id", part.partId).single();
      if (readError) throw new GmailError("לא ניתן לקרוא את תור הייבוא.");
      if (data.state === "pending" || data.state === "failed") ids.push(data.id);
    }
  }
  return { next: typeof response.nextPageToken === "string" ? response.nextPageToken : null, ids, searched: messages.length };
}
async function owned(supabase: Supabase, userId: string, id: string): Promise<GmailImportRow> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new GmailError("פריט הייבוא לא נמצא.");
  const { data, error } = await supabase.from("gmail_import_items").select("*").eq("user_id", userId).eq("id", id).single();
  if (error || !data) throw new GmailError("פריט הייבוא לא נמצא.");
  return data;
}
export async function importItem(supabase: Supabase, userId: string, id: string): Promise<string> {
  const item = await owned(supabase, userId, id);
  if (item.state === "imported" && item.document_id) return item.document_id;
  if (item.state !== "review" || !item.storage_path) throw new GmailError("המסמך עדיין לא מוכן להעברה לאישור.");
  const { data, error } = await supabase.rpc("import_gmail_document", { p_item_id: id });
  if (error || !data) throw new GmailError("לא ניתן להעביר את המסמך לאישור. נסי שוב.");
  return data;
}
export async function processItem(supabase: Supabase, userId: string, id: string): Promise<void> {
  const item = await owned(supabase, userId, id);
  if (["imported", "duplicate", "review"].includes(item.state)) return;
  const names: string[] = await settings(supabase, userId);
  const claim: string = randomUUID();
  let claimQuery = supabase.from("gmail_import_items").update({ state: "processing", claim_token: claim, claimed_at: new Date().toISOString(), reason: null }).eq("user_id", userId).eq("id", id).eq("state", item.state);
  if (item.state === "processing") claimQuery = claimQuery.lt("claimed_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const { data: acquired, error: acquireError } = await claimQuery.select("id").maybeSingle();
  if (acquireError) throw new GmailError("לא ניתן להתחיל את בדיקת הקובץ.");
  if (!acquired) throw new GmailError("הקובץ כבר בבדיקה. אם התהליך נקטע, ניתן לנסות שוב לאחר עשר דקות.");
  try {
    const account = await gmailAccount(supabase, userId);
    if (account.mailbox !== item.mailbox) throw new GmailError("הקובץ שייך לחשבון Gmail שחובר בעבר. חברי אותו מחדש כדי לבדוק את הקובץ.");
    const { bytes, part } = await getFile(account.token, item.message_id, item.part_id);
    verifyFile(bytes, part.mimeType);
    const hash: string = createHash("sha256").update(bytes).digest("hex");
    const { data: reserved, error: hashError } = await supabase.from("gmail_import_items").update({ content_hash: hash }).eq("user_id", userId).eq("id", id).eq("claim_token", claim).select("id").maybeSingle();
    if (hashError?.code === "23505") {
      const { error } = await supabase.from("gmail_import_items").update({ state: "duplicate", reason: "קובץ זהה כבר נמצא בתור הייבוא. הוא לא ייובא שוב.", claim_token: null }).eq("user_id", userId).eq("id", id).eq("claim_token", claim);
      if (error) throw error;
      return;
    }
    if (hashError) throw hashError;
    if (!reserved) throw new GmailError("הבדיקה הוחלפה בניסיון אחר. רענני את התוצאות.");
    const recognition = await recognizeAttachment(bytes, part.mimeType);
    const decision = recognition.financial ? matchRecipient(recognition.recipient, recognition.confidence, names) : "ignore";
    let path: string | null = item.storage_path;
    if (decision !== "ignore") {
      const extension: string = part.mimeType === "application/pdf" ? "pdf" : part.mimeType === "image/png" ? "png" : "jpg";
      path = `${userId}/${new Date().getUTCFullYear()}/gmail-${id}.${extension}`;
      const { error } = await supabase.storage.from("documents").upload(path, bytes, { contentType: part.mimeType, upsert: false });
      if (error && !("statusCode" in error && String(error.statusCode) === "409")) throw new GmailError("לא ניתן לשמור את הקובץ. נסי שוב.");
    }
    const reason: string = decision === "match" ? "זוהתה התאמה ברורה לשם שהגדרת" : decision === "review" ? "לא זוהתה התאמה ודאית למקבל המסמך. בדקי את הקובץ לפני הייבוא." : recognition.financial ? "שם מקבל המסמך אינו תואם לשמות שהגדרת" : "הקובץ לא זוהה כחשבונית או קבלה";
    const { data: saved, error } = await supabase.from("gmail_import_items").update({ state: decision === "ignore" ? "ignored" : "review", recipient_name: recognition.recipient, reason, storage_path: path, extraction_raw: decision === "ignore" ? null : recognition.extraction, mime_type: part.mimeType, file_size: bytes.length, claim_token: null }).eq("user_id", userId).eq("id", id).eq("claim_token", claim).select("id").maybeSingle();
    if (error || !saved) throw new GmailError("תוצאות הבדיקה לא נשמרו. נסי שוב.");
    if (decision === "match") await importItem(supabase, userId, id);
  } catch (error: unknown) {
    await supabase.from("gmail_import_items").update({ state: "failed", reason: safeImportError(error), claim_token: null }).eq("user_id", userId).eq("id", id).eq("claim_token", claim);
    throw error;
  }
}
export async function importList(supabase: Supabase, userId: string, offset: number = 0): Promise<{ rows: ImportView[]; more: boolean }> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new GmailError("מספר עמוד לא תקין.");
  const { data, error } = await supabase.from("gmail_import_items").select(VIEW_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(offset, offset + 49);
  if (error) throw new GmailError("נדרשת הרצת עדכון מסד הנתונים של ייבוא Gmail.");
  return { rows: data, more: data.length === 50 };
}
export async function preview(supabase: Supabase, userId: string, id: string): Promise<string> {
  const item = await owned(supabase, userId, id);
  if (!item.storage_path || !item.storage_path.startsWith(`${userId}/`)) throw new GmailError("אין תצוגה לקובץ זה. אפשר לבדוק אותו במייל המקורי.");
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(item.storage_path, 300);
  if (error || !data) throw new GmailError("לא ניתן לפתוח את הקובץ.");
  return data.signedUrl;
}
export async function ignoreItem(supabase: Supabase, userId: string, id: string): Promise<void> {
  const item = await owned(supabase, userId, id);
  if (item.state !== "review") throw new GmailError("ניתן לדלג רק על מסמך שממתין לבדיקת התאמה.");
  const { data, error } = await supabase.from("gmail_import_items").update({ state: "ignored", reason: "דולג לפי בחירתך", extraction_raw: null }).eq("user_id", userId).eq("id", id).eq("state", "review").select("id").maybeSingle();
  if (error || !data) throw new GmailError("לא ניתן לדלג על הקובץ. ייתכן שהמצב שלו השתנה.");
  // Retain the private source for deliberate re-checks; never delete a file used by a concurrent import.
}
