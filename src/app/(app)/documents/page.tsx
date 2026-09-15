import { RemoveReviewDocument } from "@/components/documents/RemoveReviewDocument";
import { documentsMayMatch } from "@/lib/transactions/document-matching";
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { userContext } from "@/lib/transactions/load-range";
import { loadReviewQueue } from "@/lib/transactions/review-queue";
import { formatDateDDMMYYYY } from "@/lib/format";
import type { DocumentRow, DocumentStatus } from "@/types/db";
const labels: Record<DocumentStatus, string> = { pending: "ממתין לזיהוי · אפשר להזין ידנית", processing: "מזהה נתונים…", processed: "מוכן לאישור", failed: "הזיהוי נכשל · אפשר להזין ידנית" };
export default async function DocumentsPage(): Promise<React.JSX.Element> {
  const { supabase, userId } = await userContext();
  let documents: DocumentRow[];
  try { documents = await loadReviewQueue(supabase, userId); } catch { return <p role="alert">לא ניתן לטעון את רשימת האישורים. רענני ונסי שוב.</p>; }
  const grouped = new Map<string, DocumentRow>();
  const hidden = new Set<string>();
  for (const invoice of documents.filter(document => document.extraction_raw?.doc_type === "invoice_tax")) {
    const matches = documents.filter(document => documentsMayMatch(invoice, document));
    if (matches.length === 1 && documents.filter(document => documentsMayMatch(matches[0], document)).length === 1) {
      grouped.set(invoice.id, matches[0]); hidden.add(matches[0].id);
    }
  }
  const visible = documents.filter(document => !hidden.has(document.id));
  const first = visible.find(document => document.status !== "processing");
  return <div className="flex flex-col gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">מסמכים לאישור</h1><p className="mt-2 text-foreground/60">כאן מופיעים רק מסמכים שעדיין לא אושרו. לאחר אישור אפשר לצפות ולערוך דרך התנועות.</p></div><Link href="/transactions" className="text-primary underline">צפייה ועריכה בתנועות שאושרו</Link></header>
    {documents.length === 0 ? <EmptyState title="הכול מאושר" description="אין כרגע מסמכים שממתינים לאישור." /> : <>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 p-4"><p>{documents.length} מסמכים ממתינים לאישור</p>{first && <Link className="rounded-lg bg-primary px-4 py-2 text-white" href={`/documents/${first.id}/review`}>התחילי לאשר</Link>}</div>
      <ul className="flex flex-col gap-3">{visible.map(document => <li key={document.id}><Card className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{document.file_name}</p>{grouped.has(document.id) && <div className="mt-2 rounded bg-primary/5 p-2"><p className="text-sm font-medium">קבלה שעשויה להשתייך לאותה עסקה: {grouped.get(document.id)?.file_name}</p><p className="text-xs">החיבור ייעשה רק לאחר בדיקה ואישור שלך.</p><RemoveReviewDocument id={grouped.get(document.id)!.id} /></div>}<p className="mt-1 text-sm text-foreground/60">{formatDateDDMMYYYY(document.uploaded_at)} · {labels[document.status]}</p></div><Badge variant={document.direction === "income" ? "income" : "expense"}>{document.direction === "income" ? "הכנסה" : "הוצאה"}</Badge>{document.status !== "processing" && <Link className="rounded-lg border border-border px-3 py-2 text-primary" href={`/documents/${document.id}/review`}>בדיקה ואישור</Link>}<RemoveReviewDocument id={document.id} /></Card></li>)}</ul>
    </>}
    <Link className="text-primary underline" href="/upload">העלאת מסמכים נוספים</Link>
  </div>;
}
