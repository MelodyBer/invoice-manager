"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "./load-range";
import { validateTransactionValues } from "./validate-values";
import type { TransactionFormValues } from "@/types/transaction-form";
import type { TransactionRow, DocumentRow, CategoryRow } from "@/types/db";
export type Detail = { transaction: TransactionRow; document: DocumentRow | null; documents: DocumentRow[]; categories: CategoryRow[] };
export type ActionResult = { error?: string; duplicateId?: string; success?: boolean };
export async function getDetail(id: string): Promise<{ detail?: Detail; error?: string }> {
  const { supabase, userId } = await userContext();
  const { data: transaction, error } = await supabase.from("transactions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error || !transaction) return { error: "התנועה לא נמצאה או שאין הרשאה לצפות בה." };
  const [categoryResult, documentResult] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", userId).order("name"),
    transaction.document_id
      ? supabase.from("documents").select("*").eq("user_id", userId).eq("id", transaction.document_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (categoryResult.error) return { error: "לא ניתן לטעון את הקטגוריות." };
  if (documentResult.error) return { error: "לא ניתן לטעון את המסמך." };
  const categories = categoryResult.data;
  const document = documentResult.data;
  const attachments = await supabase.from("documents").select("*").eq("user_id", userId).eq("transaction_id", id).order("uploaded_at");
  if (attachments.error) return { error: "לא ניתן לטעון את המסמכים המצורפים." };
  const documents = [...(attachments.data ?? [])];
  if (document && !documents.some(item => item.id === document.id)) documents.unshift(document);
  return { detail: { transaction, document, documents, categories: categories ?? [] } };
}
export async function updateTransaction(id: string, values: TransactionFormValues, expectedUpdatedAt: string, allowDuplicate = false): Promise<ActionResult> {
  const { supabase, userId } = await userContext();
  if (!values || typeof values !== "object" || [values.counterpartyName, values.docDate, values.docNumber, values.notes, values.amountTotal, values.amountBeforeVat, values.vatAmount, values.vatRate].some(value => typeof value !== "string") || !["income", "expense"].includes(values.direction) || !["invoice_tax", "invoice_tax_receipt", "receipt", "invoice_offer", "other"].includes(values.docType)) return { error: "נתוני הטופס אינם תקינים." };
  const error = validateTransactionValues(values); if (error) return { error };
  if (values.categoryId) {
    const category = await supabase.from("categories").select("id").eq("user_id", userId).eq("id", values.categoryId).eq("direction", values.direction).maybeSingle();
    if (category.error || !category.data) return { error: "יש לבחור קטגוריה מתאימה." };
  }
  if (!allowDuplicate) {
    let query = supabase.from("transactions").select("id").eq("user_id", userId).neq("id", id).eq("counterparty_name", values.counterpartyName.trim()).eq("doc_date", values.docDate);
    query = values.docNumber.trim() ? query.eq("doc_number", values.docNumber.trim()) : query.is("doc_number", null);
    const duplicate = await query.limit(1).maybeSingle();
    if (duplicate.error) return { error: "לא ניתן לבדוק כפילויות." };
    if (duplicate.data) return { duplicateId: duplicate.data.id };
  }
  const result = await supabase.from("transactions").update({ direction: values.direction, counterparty_name: values.counterpartyName.trim(), doc_number: values.docNumber.trim() || null, doc_type: values.docType, doc_date: values.docDate, amount_before_vat: Number(values.amountBeforeVat), vat_amount: Number(values.vatAmount), amount_total: Number(values.amountTotal), vat_rate: Number(values.vatRate), vat_deductible_percent: values.direction === "expense" ? values.vatDeductiblePercent : 100, category_id: values.categoryId, notes: values.notes.trim() || null }).eq("user_id", userId).eq("id", id).eq("updated_at", expectedUpdatedAt).select("id");
  if (result.error) return { error: "השמירה נכשלה. נסי שוב." };
  if (!result.data?.length) return { error: "התנועה השתנתה או נמחקה. סגרי את החלונית ופתחי אותה מחדש." };
  revalidatePath("/transactions"); revalidatePath(`/transactions/${id}`); revalidatePath("/calendar");
  return { success: true };
}
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase, userId } = await userContext();
  const transaction = await supabase.from("transactions").select("document_id").eq("user_id", userId).eq("id", id).maybeSingle();
  if (transaction.error || !transaction.data) return { error: "התנועה לא נמצאה או שכבר נמחקה." };
  const primaryDocumentId = transaction.data.document_id;
  const linkedDocuments = await supabase.from("documents").select("*").eq("user_id", userId).eq("transaction_id", id);
  if (linkedDocuments.error) return { error: "לא ניתן לבדוק את המסמכים למחיקה." };
  const documents = [...(linkedDocuments.data ?? [])];
  if (primaryDocumentId && !documents.some(document => document.id === primaryDocumentId)) {
    const legacy = await supabase.from("documents").select("*").eq("user_id", userId).eq("id", primaryDocumentId).maybeSingle();
    if (legacy.error || !legacy.data) return { error: "לא ניתן לאמת את המסמך למחיקה." };
    documents.push(legacy.data);
  }
  if (documents.length) {
    const shared = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).in("document_id", documents.map(document => document.id)).neq("id", id);
    if (shared.error || shared.count || documents.some(document => (document.transaction_id && document.transaction_id !== id) || document.storage_path.split("/")[0] !== userId)) return { error: "מסמך מקושר לתנועה נוספת או שלא ניתן לאמת את הבעלות. המחיקה נעצרה." };
    const removed = await supabase.storage.from("documents").remove(documents.map(document => document.storage_path));
    if (removed.error) return { error: "מחיקת הקבצים נכשלה. התנועה נשמרה; נסי שוב." };
    const deleted = await supabase.from("documents").delete().eq("user_id", userId).in("id", documents.map(document => document.id));
    if (deleted.error) return { error: "הקבצים נמחקו אך ניקוי הרשומות נכשל. נסי שוב להשלמה." };
  }
  const result = await supabase.from("transactions").delete().eq("user_id", userId).eq("id", id).select("id");
  if (result.error) return { error: "מחיקת התנועה לא הושלמה. אם צורף מסמך, ייתכן שכבר נמחק. נסי שוב." };
  revalidatePath("/transactions"); revalidatePath(`/transactions/${id}`); revalidatePath("/calendar"); revalidatePath("/documents");
  return { success: true };
}
