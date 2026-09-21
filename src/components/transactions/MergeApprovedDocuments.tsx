"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { MoneySummary } from "./MoneySummary";
import { getDetail, type Detail } from "@/lib/transactions/detail-actions";
import { searchApprovedComplement, mergeApprovedDocuments } from "@/lib/transactions/merge-approved";
import { formatDateDDMMYYYY } from "@/lib/format";
import { formatMoney } from "@/lib/currency/money";
import type { TransactionRow } from "@/types/db";
export function MergeApprovedDocuments({transaction,onMerged}:{transaction:TransactionRow;onMerged?:()=>void}):React.JSX.Element|null{
 const router=useRouter();
 const [open,setOpen]=useState(false),[term,setTerm]=useState(""),[results,setResults]=useState<TransactionRow[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [comparison,setComparison]=useState<{invoice:Detail;receipt:Detail}|null>(null);
 if(!transaction.is_verified||!["invoice_tax","receipt"].includes(transaction.doc_type)||!transaction.document_id)return null;
 const targetLabel=transaction.doc_type==="receipt"?"חשבונית מס":"קבלה";
 async function search():Promise<void>{setBusy(true);setError("");setComparison(null);try{const result=await searchApprovedComplement(transaction.id,term);setResults(result.transactions);setError(result.error??(result.transactions.length?"":"לא נמצאו מסמכים מתאימים לחיפוש. נסי שם או מספר אחר."));}catch{setError("החיפוש נכשל. נסי שוב.");}finally{setBusy(false);}}
 async function choose(target:TransactionRow):Promise<void>{setBusy(true);setError("");try{const [source,other]=await Promise.all([getDetail(transaction.id),getDetail(target.id)]);if(!source.detail||!other.detail){setError(source.error??other.error??"לא ניתן לטעון את המסמכים.");return;}if(source.detail.documents.length!==1||other.detail.documents.length!==1){setError("אפשר לחבר שתי תנועות שבכל אחת מסמך אחד. אחת התנועות כבר כוללת כמה מסמכים.");return;}setComparison(transaction.doc_type==="invoice_tax"?{invoice:source.detail,receipt:other.detail}:{invoice:other.detail,receipt:source.detail});}catch{setError("לא ניתן לטעון את המסמכים.");}finally{setBusy(false);}}
 async function confirm():Promise<void>{if(!comparison||busy)return;setBusy(true);setError("");try{const {invoice,receipt}=comparison;const result=await mergeApprovedDocuments(invoice.transaction.id,receipt.transaction.id,invoice.transaction.updated_at,receipt.transaction.updated_at);if(result.error)setError(result.error);else if(result.id){onMerged?.();router.push(`/transactions/${result.id}`);router.refresh();}}catch{setError("החיבור נכשל. רענני ובדקי אם החיבור כבר הושלם לפני ניסיון נוסף.");}finally{setBusy(false);}}
 return <section className="my-4 min-w-0 rounded-xl border border-border p-4">
 <Button variant="secondary" disabled={busy||transaction.currency_review_required} aria-expanded={open} onClick={()=>{setOpen(current=>!current);setComparison(null);setError("");}}>חיבור ל{targetLabel} שכבר אושרה</Button>
 {transaction.currency_review_required&&<p className="mt-2 text-sm">יש לבדוק ולשמור קודם את המטבע בתנועה זו.</p>}
 {open&&<><p className="my-3 text-sm">חפשי את המסמך המשלים. זו בחירה ידנית — בדקי ששניהם שייכים לאותה עסקה. הסכום ייספר פעם אחת לפי חשבונית המס.</p>
 <div className="flex flex-wrap items-end gap-2"><Input id={`merge-search-${transaction.id}`} label={`שם או מספר ${targetLabel}`} value={term} onChange={event=>setTerm(event.target.value)}/><Button isLoading={busy} onClick={()=>void search()}>חיפוש</Button></div>
 {error&&<p role="alert" className="mt-3 text-expense">{error}</p>}
 {!comparison&&<ul className="mt-3 space-y-2">{results.map(item=><li key={item.id} className="rounded border border-border p-3"><p className="break-words">{item.counterparty_name} · מספר {item.doc_number??"לא צוין"}</p><p className="text-sm">{formatDateDDMMYYYY(item.doc_date)} · {formatMoney(item.amount_total,"ILS")}{item.currency==="USD"&&item.original_amount_total!==null?` · ${formatMoney(item.original_amount_total,"USD")}`:""}</p><Button variant="secondary" disabled={busy} onClick={()=>void choose(item)}>בדיקת שני המסמכים לפני חיבור</Button></li>)}</ul>}
 {comparison&&<div className="mt-4"><div className="grid min-w-0 items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))" }}>{([["חשבונית המס שתישאר בתנועות",comparison.invoice],["הקבלה שתצורף לחשבונית",comparison.receipt]] as const).map(([label,detail])=><section key={detail.transaction.id} className="min-w-0 rounded border border-border p-3"><h3 className="font-bold">{label}</h3><p className="break-words">{detail.transaction.counterparty_name} · {detail.transaction.doc_number??"ללא מספר"}</p><MoneySummary value={detail.transaction} date={detail.transaction.doc_date}/>{detail.documents.map(document=><DocumentViewer key={document.id} storagePath={document.storage_path} mimeType={document.mime_type}/>)}</section>)}</div>
 <p className="my-4 font-medium">לאחר החיבור תישאר תנועה אחת בסך {formatMoney(comparison.invoice.transaction.amount_total,"ILS")}, לפי החשבונית. תנועת הקבלה הנפרדת תוסר מהסיכומים. שני הקבצים, הסכומים המקוריים והשערים שלהם יישמרו; הערות הקבלה יצורפו להערות החשבונית. אין אפשרות ביטול אוטומטית לחיבור.</p>
 <p className="mb-3 text-sm">אם הסכומים, התאריכים או המטבעות שונים, ודאי שהמסמכים אכן מתייחסים לאותה עסקה.</p>
 <div className="flex flex-wrap gap-2"><Button isLoading={busy} onClick={()=>void confirm()}>מאשרת — חבר לתנועה אחת</Button><Button variant="secondary" disabled={busy} onClick={()=>setComparison(null)}>ביטול החיבור</Button></div></div>}
 </>}
 </section>;
}
