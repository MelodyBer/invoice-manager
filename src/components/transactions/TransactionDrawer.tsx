"use client";
import { MergeApprovedDocuments } from "./MergeApprovedDocuments";
import { MoneySummary } from "./MoneySummary";
import { formFromTransaction } from "@/lib/transactions/form-from-transaction";
import { buildInitialValuesFromExtraction } from "@/lib/transactions/build-initial-values";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { TransactionForm } from "./TransactionForm";
import { useTransactionForm } from "@/lib/transactions/use-transaction-form";
import { buildEmptyManualValues } from "@/lib/transactions/build-initial-values";
import { getDetail, updateTransaction, deleteTransaction, type Detail } from "@/lib/transactions/detail-actions";
import { formatCurrencyILS, formatDateDDMMYYYY } from "@/lib/format";
import { DOC_TYPE_OPTIONS } from "@/types/transaction-form";
export function TransactionDrawer({ id, onClose }: { id: string; onClose: () => void }): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null); const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const form = useTransactionForm(buildEmptyManualValues(null));
  const resetTo = form.resetTo;
  useEffect(() => {
    ref.current?.showModal(); let active = true;
    getDetail(id).then(result => {
      if (!active) return;
      if (!result.detail) { setError(result.error ?? "לא ניתן לטעון את התנועה."); return; }
      setDetail(result.detail);
      const t = result.detail.transaction;
      const initial = formFromTransaction(t);
      if (t.currency_review_required && result.detail.document) {
        const extracted = buildInitialValuesFromExtraction(t.direction,result.detail.document.extraction_raw,null);
        resetTo({...initial,currency:extracted.currency,amountBeforeVat:extracted.amountBeforeVat,vatAmount:extracted.vatAmount,amountTotal:extracted.amountTotal,vatRate:extracted.vatRate});
      } else resetTo(initial);
    }).catch(() => { if (active) setError("לא ניתן לטעון את התנועה. בדקי את החיבור לרשת."); });
    return () => { active = false; };
  }, [id, resetTo]);
  async function save(allowDuplicate = false): Promise<void> {
    if (!detail || busy) return; setBusy(true); setError("");
    try {
      const result = await updateTransaction(id, form.values, detail.transaction.updated_at, allowDuplicate);
      if (result.error) setError(result.error);
      else if (result.duplicateId) setDuplicateId(result.duplicateId);
      else { router.refresh(); onClose(); }
    } catch { setError("השמירה נכשלה. בדקי את החיבור ונסי שוב."); } finally { setBusy(false); }
  }
  async function remove(): Promise<void> {
    if (busy) return; setBusy(true); setError("");
    try { const result = await deleteTransaction(id); if (result.error) setError(result.error); else { router.refresh(); onClose(); } }
    catch { setError("המחיקה לא הושלמה. בדקי את החיבור ונסי שוב."); } finally { setBusy(false); }
  }
  const t = detail?.transaction;
  const fields: [string, string][] = t ? [["סוג", t.direction === "income" ? "הכנסה" : "הוצאה"], ["שם הספק או הלקוח", t.counterparty_name], ["מספר מסמך", t.doc_number ?? "לא צוין"], ["סוג מסמך", DOC_TYPE_OPTIONS.find(option => option.value === t.doc_type)?.label ?? "אחר"], ["תאריך", formatDateDDMMYYYY(t.doc_date)], ["קטגוריה", detail?.categories.find(category => category.id === t.category_id)?.name ?? "ללא קטגוריה"], ["לפני מע״מ", formatCurrencyILS(t.amount_before_vat)], ["מע״מ", formatCurrencyILS(t.vat_amount)], ["סכום כולל", formatCurrencyILS(t.amount_total)], ["שיעור מע״מ", `${t.vat_rate}%`], ["אחוז הכרה במע״מ", `${t.vat_deductible_percent}%`], ["סטטוס", t.is_verified ? "מאושרת" : "ממתינה לאישור"], ["הערות", t.notes ?? "אין הערות"]] : [];
  return <dialog ref={ref} aria-labelledby="transaction-detail-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-2xl overflow-y-auto border-s border-border bg-background p-4 text-foreground shadow-xl backdrop:bg-black/40 sm:p-6">
    <header className="mb-5 flex items-center justify-between"><h2 id="transaction-detail-title" className="text-xl font-bold">פרטי התנועה</h2><Button variant="ghost" disabled={busy} onClick={onClose}>סגירה</Button></header>
    {error && <p role="alert" className="mb-4 rounded border border-expense p-3 text-expense">{error}</p>}
    {!detail && !error && <Spinner />}
    {detail && <>
      <MoneySummary value={detail.transaction} date={detail.transaction.doc_date} needsReview={detail.transaction.currency_review_required} />
      {editing ? <fieldset disabled={busy}><TransactionForm values={form.values} onFieldChange={form.setField} categories={detail.categories} confidence={null} isVatManuallyEdited={form.isVatManuallyEdited} /></fieldset> : <dl className="grid grid-cols-2 gap-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-foreground/60">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>}
      {duplicateId && <section role="alert" className="my-4 rounded border border-warning p-3"><p>נראה שהמסמך הזה כבר קיים במערכת</p><Link className="text-primary underline" href={`/transactions/${duplicateId}`}>צפייה בתנועה הקיימת</Link><div className="mt-2 flex gap-2"><Button disabled={busy} onClick={() => setDuplicateId(null)}>בטל</Button><Button isLoading={busy} onClick={() => void save(true)}>שמור בכל זאת</Button></div></section>}
      {confirmDelete ? <section role="alert" className="my-4 rounded border border-expense p-4"><p>למחוק את התנועה? {detail.documents.length ? "כל המסמכים המצורפים יימחקו גם הם. לא ניתן לבטל את המחיקה." : "לא ניתן לבטל את המחיקה."}</p><div className="mt-3 flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>בטל</Button><Button className="bg-expense" isLoading={busy} onClick={() => void remove()}>מחק לצמיתות</Button></div></section> : <div className="my-5 flex gap-2">{editing ? <><Button isLoading={busy} onClick={() => void save()}>שמירת שינויים</Button><Button variant="secondary" disabled={busy} onClick={() => { setEditing(false); setDuplicateId(null); }}>ביטול עריכה</Button></> : <Button onClick={() => setEditing(true)}>עריכה</Button>}<Button variant="secondary" disabled={busy} onClick={() => setConfirmDelete(true)}>מחיקה</Button></div>}
      {!editing && !confirmDelete && <MergeApprovedDocuments key={id} transaction={detail.transaction} onMerged={onClose} />}
      {detail.documents.map(document => <section key={document.id} className="mt-6"><h3 className="mb-3 font-semibold">{document.file_name}</h3><MoneySummary value={document} date={document.valuation_date} /><DocumentViewer storagePath={document.storage_path} mimeType={document.mime_type} /></section>)}
    </>}
  </dialog>;
}
