import { transactionPayload } from "./transaction-payload";
import { validateTransactionValues } from "./validate-values";
import type { createClient } from "@/lib/supabase/client";
import type { TransactionFormValues } from "@/types/transaction-form";

type AppSupabaseClient = ReturnType<typeof createClient>;

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface SaveTransactionResult {
  errorMessage: string | null;
}

export async function insertTransaction(
  supabase: AppSupabaseClient,
  userId: string,
  documentId: string | null,
  values: TransactionFormValues
): Promise<SaveTransactionResult> {
  const validation = validateTransactionValues(values);
  if (validation) return { errorMessage: validation };
  if (documentId) {
    const { error } = await supabase.rpc("confirm_documents", { p_document_ids: [documentId], p_values: transactionPayload(values) });
    return { errorMessage: error ? "השמירה נכשלה. ייתכן שהמסמך כבר אושר או הוסר. רענני ובדקי." : null };
  }
  const [document, category] = await Promise.all([
    documentId ? supabase.from("documents").select("id").eq("user_id", userId).eq("id", documentId).single() : Promise.resolve(null),
    values.categoryId ? supabase.from("categories").select("id").eq("user_id", userId).eq("id", values.categoryId).eq("direction", values.direction).single() : Promise.resolve(null),
  ]);
  if (documentId && (document?.error || !document?.data)) return { errorMessage: "המסמך לא נמצא או שאין הרשאה לשמור אותו." };
  if (values.categoryId && (category?.error || !category?.data)) return { errorMessage: "הקטגוריה אינה מתאימה לתנועה." };
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    document_id: documentId,
    direction: values.direction,
    counterparty_name: values.counterpartyName.trim(),
    doc_number: values.docNumber.trim() || null,
    doc_type: values.docType,
    doc_date: values.docDate,
    amount_before_vat: toNumber(values.amountBeforeVat),
    vat_amount: toNumber(values.vatAmount),
    amount_total: toNumber(values.amountTotal),
    vat_rate: toNumber(values.vatRate),
    vat_deductible_percent: values.direction === "expense" ? values.vatDeductiblePercent : 100,
    category_id: values.categoryId,
    notes: values.notes || null,
    is_verified: true,
  });

  return { errorMessage: error ? "השמירה נכשלה. נסי שוב." : null };
}
