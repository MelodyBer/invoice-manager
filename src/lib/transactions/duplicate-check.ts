import type { createClient } from "@/lib/supabase/client";

import type { DocType, Direction } from "@/types/db";

type AppSupabaseClient = ReturnType<typeof createClient>;

export async function findDuplicateTransactionId(
  supabase: AppSupabaseClient,
  userId: string,
  params: { counterpartyName: string; docNumber: string; docDate: string }
): Promise<string | null> {
  let query = supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("counterparty_name", params.counterpartyName)
    .eq("doc_date", params.docDate);

  query = params.docNumber
    ? query.eq("doc_number", params.docNumber)
    : query.is("doc_number", null);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error("לא ניתן לבדוק כפילויות. נסי שוב.");
  return data?.id ?? null;
}

// An invoice and its receipt complement each other; only matching document types
// are presented as possible copies before approval.
export async function findApprovedDuplicateId(
  supabase: AppSupabaseClient,
  userId: string,
  params: { counterpartyName: string; docNumber: string; docDate: string; docType: DocType; direction: Direction }
): Promise<string | null> {
  if (!params.counterpartyName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(params.docDate)) return null;
  let query = supabase.from("transactions").select("id")
    .eq("user_id", userId).eq("is_verified", true)
    .eq("counterparty_name", params.counterpartyName.trim())
    .eq("doc_date", params.docDate).eq("doc_type", params.docType)
    .eq("direction", params.direction);
  query = params.docNumber.trim() ? query.eq("doc_number", params.docNumber.trim()) : query.is("doc_number", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("בדיקת הכפילות לא הושלמה. נסי שוב.");
  return data?.id ?? null;
}
