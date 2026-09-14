import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "@/types/db";
export async function userContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}
export async function loadRange(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, start: string, end: string): Promise<TransactionRow[]> {
  const rows: TransactionRow[] = [];
  // Supabase caps a single response. Read only the requested date range in batches.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).eq("is_verified", true).gte("doc_date", start).lte("doc_date", end).order("id").range(offset, offset + 499);
    if (error) throw new Error("לא ניתן לטעון את התנועות. נסי שוב.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
