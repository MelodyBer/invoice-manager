"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "@/lib/transactions/load-range";
import { discover, processItem, importItem, ignoreItem, preview, importList, safeImportError } from "@/lib/integrations/gmail-import";
import type { ImportReply, ImportView } from "@/types/gmail-import";

export async function searchGmail(start: string, end: string, token: string | null): Promise<{ ok: boolean; message: string; next: string | null; ids: string[]; searched: number }> {
  const { supabase, userId } = await userContext();
  try { return { ok: true, message: "", ...await discover(supabase, userId, start, end, token) }; }
  catch (error: unknown) { return { ok: false, message: safeImportError(error), next: token, ids: [], searched: 0 }; }
}
export async function checkGmailItem(id: string): Promise<ImportReply> {
  const { supabase, userId } = await userContext();
  try { await processItem(supabase, userId, id); revalidatePath("/documents"); return { ok: true, message: "בדיקת הקובץ הסתיימה." }; }
  catch (error: unknown) { return { ok: false, message: safeImportError(error) }; }
}
export async function decideGmailItem(id: string, decision: "import" | "ignore"): Promise<ImportReply> {
  const { supabase, userId } = await userContext();
  try {
    if (decision !== "import" && decision !== "ignore") return { ok: false, message: "בחירה לא תקינה." };
    if (decision === "ignore") { await ignoreItem(supabase, userId, id); return { ok: true, message: "המסמך לא יועבר לאישור." }; }
    const documentId: string = await importItem(supabase, userId, id);
    revalidatePath("/documents");
    return { ok: true, message: "המסמך הועבר לאישור שלך.", documentId };
  } catch (error: unknown) { return { ok: false, message: safeImportError(error) }; }
}
export async function showGmailItem(id: string): Promise<{ url: string | null; message: string }> {
  const { supabase, userId } = await userContext();
  try { return { url: await preview(supabase, userId, id), message: "" }; }
  catch (error: unknown) { return { url: null, message: safeImportError(error) }; }
}
export async function refreshGmailItems(offset: number): Promise<{ rows: ImportView[]; more: boolean; message: string }> {
  const { supabase, userId } = await userContext();
  try { return { ...await importList(supabase, userId, offset), message: "" }; }
  catch (error: unknown) { return { rows: [], more: false, message: safeImportError(error) }; }
}
