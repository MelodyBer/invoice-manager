import type { createClient } from "@/lib/supabase/client";

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
