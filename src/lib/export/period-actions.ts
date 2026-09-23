"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "@/lib/transactions/load-range";
import { resolveExportRange } from "./range";
import { loadExportData } from "./load-export-data";
import type { SearchValues } from "@/lib/transactions/reporting";

export async function submitPeriod(params: SearchValues): Promise<{ error?: string }> {
  const { supabase, userId } = await userContext();
  const profile = await supabase.from("profiles").select("reporting_frequency").eq("id", userId).single();
  if (profile.error || !profile.data) return { error: "לא ניתן לטעון את ההגדרות. רענני ונסי שוב." };
  let range: ReturnType<typeof resolveExportRange>;
  try {
    range = resolveExportRange(params, profile.data.reporting_frequency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "טווח לא תקין." };
  }
  // Only an actual VAT reporting period can be marked as submitted, not an arbitrary day/week/custom range.
  if (range.preset !== "period") return { error: "אפשר לסמן כהוגשה רק תקופת דיווח שלמה." };
  const existing = await supabase.from("periods").select("id, status").eq("user_id", userId).eq("period_start", range.start).eq("period_end", range.end).maybeSingle();
  if (existing.error) return { error: "לא ניתן לבדוק אם התקופה כבר הוגשה. נסי שוב." };
  if (existing.data?.status === "closed") return { error: "התקופה הזו כבר סומנה כהוגשה." };
  let data: Awaited<ReturnType<typeof loadExportData>>;
  try {
    data = await loadExportData(supabase, userId, range);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "טעינת הנתונים נכשלה." };
  }
  const submittedAt = new Date().toISOString();
  const snapshot = { label: range.label, summary: data.summary, transactionCount: data.rows.length, submittedAt };
  const result = existing.data
    ? await supabase.from("periods").update({ status: "closed", submitted_at: submittedAt, snapshot }).eq("id", existing.data.id).eq("user_id", userId)
    : await supabase.from("periods").insert({ user_id: userId, period_start: range.start, period_end: range.end, status: "closed", submitted_at: submittedAt, snapshot });
  if (result.error) return { error: "סימון התקופה כהוגשה נכשל. נסי שוב." };
  revalidatePath("/export");
  revalidatePath("/export/history");
  return {};
}
