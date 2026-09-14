import type { createClient } from "@/lib/supabase/client";
import type { DocumentRow } from "@/types/db";
export async function loadReviewQueue(supabase: ReturnType<typeof createClient>, userId: string): Promise<DocumentRow[]> {
  const queue: DocumentRow[] = [];
  for (let offset = 0; ; offset += 200) {
    const batch = await supabase.from("documents").select("*").eq("user_id", userId).order("uploaded_at").order("id").range(offset, offset + 199);
    if (batch.error) throw new Error("לא ניתן לטעון את המסמכים.");
    const documents = batch.data ?? [];
    if (!documents.length) return queue;
    const linked = new Set<string>();
    for (let start = 0; ; start += 500) {
      const result = await supabase.from("transactions").select("document_id").eq("user_id", userId).eq("is_verified", true).in("document_id", documents.map(document => document.id)).order("id").range(start, start + 499);
      if (result.error) throw new Error("לא ניתן לבדוק אילו מסמכים אושרו.");
      for (const row of result.data ?? []) if (row.document_id) linked.add(row.document_id);
      if ((result.data ?? []).length < 500) break;
    }
    queue.push(...documents.filter(document => !linked.has(document.id)));
    if (documents.length < 200) return queue;
  }
}
