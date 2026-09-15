"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { Button,Dialog,Input } from "@/components/ui";
import { searchInvoices,attachReceipt } from "@/lib/transactions/attach-receipt";
import { MoneySummary } from "@/components/transactions/MoneySummary";
import { CurrencyPreview } from "@/components/transactions/CurrencyPreview";
import { formatMoney } from "@/lib/currency/money";
import { formatDateDDMMYYYY } from "@/lib/format";
import type { TransactionRow } from "@/types/db";
import type { TransactionFormValues } from "@/types/transaction-form";
export function ReceiptAttachment({documentId,values}:{documentId:string;values:TransactionFormValues}):React.JSX.Element{
 const router=useRouter(),[term,setTerm]=useState(""),[invoices,setInvoices]=useState<TransactionRow[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[selected,setSelected]=useState<TransactionRow|null>(null);
 useEffect(()=>{let active=true;setLoading(true);void searchInvoices(documentId,"").then(result=>{if(active){setInvoices(result.invoices);setError(result.error??"");}}).catch(()=>{if(active)setError("טעינת החשבוניות נכשלה.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[documentId]);
 async function search():Promise<void>{setLoading(true);setError("");try{const result=await searchInvoices(documentId,term);setInvoices(result.invoices);setError(result.error??"");}catch{setError("החיפוש נכשל. נסי שוב.");}finally{setLoading(false);}}
 async function confirm():Promise<void>{if(!selected||busy)return;setBusy(true);setError("");try{const result=await attachReceipt(documentId,selected.id,selected.updated_at,values);if(result.error)setError(result.error);else{router.replace(`/transactions/${selected.id}`);router.refresh();}}catch{setError("הצירוף נכשל. נסי שוב.");}finally{setBusy(false);}}
 return <section id="attach-receipt" className="rounded-xl border-2 border-primary p-4"><h2 className="font-bold">צרפי את הקבלה לחשבונית שכבר אושרה</h2><p className="my-2 text-sm">בחרי חשבונית ובדקי שהיא שייכת לאותה עסקה. הצירוף אינו יוצר הכנסה או הוצאה נוספת.</p><div className="flex flex-wrap items-end gap-2"><Input id="invoice-search" label="חיפוש לפי שם או מספר חשבונית" value={term} onChange={event=>setTerm(event.target.value)} /><Button variant="secondary" isLoading={loading} onClick={()=>void search()}>חפש חשבונית</Button></div>
 {error&&<p role="alert" className="mt-2 text-expense">{error}</p>}
 <ul className="mt-3 space-y-2">{invoices.map(invoice=><li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3"><div><p>{invoice.counterparty_name} · חשבונית {invoice.doc_number??"ללא מספר"}</p><p className="text-sm">{formatDateDDMMYYYY(invoice.doc_date)} · {invoice.currency==="USD"&&invoice.original_amount_total!==null?formatMoney(invoice.original_amount_total,"USD")+" · ":""}{formatMoney(invoice.amount_total,"ILS")}</p></div>{invoice.currency_review_required&&<p className="text-warning">יש לערוך קודם את המטבע בתנועה זו. <Link className="underline" href={`/transactions/${invoice.id}`}>פתיחת התנועה לעריכה</Link></p>}<Button disabled={busy||invoice.currency_review_required} onClick={()=>{setError("");setSelected(invoice);}}>צרף קבלה לחשבונית</Button></li>)}</ul>
 {!loading&&!invoices.length&&<p className="mt-2">לא נמצאו חשבוניות. נסי חיפוש בשם אחר או בדקי שהחשבונית אושרה.</p>}
 <Dialog isOpen={Boolean(selected)} onClose={()=>{if(!busy)setSelected(null);}} title="אישור צירוף קבלה לחשבונית">
 {selected&&<><p>החשבונית: {selected.counterparty_name}, מספר {selected.doc_number??"לא צוין"}, {formatDateDDMMYYYY(selected.doc_date)}.</p><MoneySummary value={selected} date={selected.doc_date} /><p>הסכום בתנועה נשאר {formatMoney(selected.amount_total,"ILS")}.</p><p className="mt-3">הקבלה: {values.counterpartyName}, מספר {values.docNumber||"לא צוין"}, {formatDateDDMMYYYY(values.docDate)}.</p><CurrencyPreview values={values}/><p className="my-3">אני מאשרת ששני המסמכים שייכים לאותה עסקה. מטבע, סכום או תאריך שונים יישמרו בכל מסמך בנפרד; לא תיווצר תנועה נוספת.</p>{error&&<p role="alert" className="text-expense">{error}</p>}<div className="mt-3 flex gap-2"><Button variant="secondary" disabled={busy} onClick={()=>setSelected(null)}>ביטול</Button><Button isLoading={busy} onClick={()=>void confirm()}>אשר צירוף</Button></div></>}
 </Dialog></section>;
}
