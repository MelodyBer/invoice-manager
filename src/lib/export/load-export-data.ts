import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { summarize, type Summary } from "@/lib/calc";
import { loadRange } from "@/lib/transactions/load-range";
import type { ProfileRow, TransactionRow } from "@/types/db";
import type { ExportRange } from "./range";

export interface ExportDocument {
  id: string;
  transactionId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
}

export interface ExportData {
  profile: ProfileRow;
  range: ExportRange;
  rows: TransactionRow[];
  categoryNames: Record<string, string>;
  businessNumbers: Record<string, string>;
  summary: Summary;
  documents: ExportDocument[];
  currencyReviewCount: number;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function loadExportData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, range: ExportRange): Promise<ExportData> {
  const [profileResult, categoryResult, allRows] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("categories").select("id, name").eq("user_id", userId),
    loadRange(supabase, userId, range.start, range.end),
  ]);
  if (profileResult.error || !profileResult.data) throw new Error("לא ניתן לטעון את פרטי העסק. רענני ונסי שוב.");
  if (categoryResult.error) throw new Error("לא ניתן לטעון את הקטגוריות. רענני ונסי שוב.");
  const categoryNames = Object.fromEntries((categoryResult.data ?? []).map(category => [category.id, category.name]));

  // Currency-review rows have unreliable amounts; they are excluded from every export output, same as dashboard totals.
  const rows = allRows.filter(row => !row.currency_review_required);
  const transactionIds = rows.map(row => row.id);
  const documents: ExportDocument[] = [];
  const businessNumbers: Record<string, string> = {};
  for (const ids of chunk(transactionIds, 200)) {
    const { data, error } = await supabase.from("documents").select("*").eq("user_id", userId).in("transaction_id", ids);
    if (error) throw new Error("לא ניתן לטעון את המסמכים לייצוא. רענני ונסי שוב.");
    for (const document of data ?? []) {
      if (!document.transaction_id) continue;
      documents.push({ id: document.id, transactionId: document.transaction_id, storagePath: document.storage_path, fileName: document.file_name, mimeType: document.mime_type });
      const businessNumber = typeof document.extraction_raw?.business_number === "string" ? document.extraction_raw.business_number.trim() : "";
      if (businessNumber && !businessNumbers[document.transaction_id]) businessNumbers[document.transaction_id] = businessNumber;
    }
  }

  const profile = profileResult.data;
  const summary = summarize(rows, { incomeTaxAdvanceRate: profile.income_tax_advance_rate, taxReserveRate: profile.tax_reserve_rate });
  const currencyReviewCount = allRows.length - rows.length;
  return { profile, range, rows, categoryNames, businessNumbers, summary, documents, currencyReviewCount };
}
