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
      <div className="flex flex-col items-stretch gap-3 rounded-xl bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><p>{documents.length} מסמכים ממתינים לאישור</p>{first && <Link className="shrink-0 rounded-lg bg-primary px-4 py-2 text-center text-white" href={`/documents/${first.id}/review`}>התחילי לאשר</Link>}</div>
      <ul className="flex min-w-0 flex-col gap-3">{visible.map(document => <li key={document.id} className="min-w-0">
        <Card className="min-w-0">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p dir="auto" title={document.file_name} className="truncate text-start font-medium">{document.file_name}</p>
              <p className="mt-2 text-sm text-foreground/60">{formatDateDDMMYYYY(document.uploaded_at)} · {labels[document.status]}</p>
              {grouped.has(document.id) && <div className="mt-3 min-w-0 rounded-lg bg-primary/5 p-3">
                <p className="text-sm font-medium">קבלה שעשויה להשתייך לאותה עסקה:</p>
                <p dir="auto" title={grouped.get(document.id)?.file_name} className="mt-1 truncate text-start text-sm">{grouped.get(document.id)?.file_name}</p>
                <p className="mt-2 text-xs">החיבור ייעשה רק לאחר בדיקה ואישור שלך.</p>
                <RemoveReviewDocument id={grouped.get(document.id)!.id} />
              </div>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border pt-3 sm:border-0 sm:pt-0">
              <Badge variant={document.direction === "income" ? "income" : "expense"}>{document.direction === "income" ? "הכנסה" : "הוצאה"}</Badge>
              {document.status !== "processing" && <Link className="whitespace-nowrap rounded-lg border border-border px-3 py-2 text-primary" href={`/documents/${document.id}/review`}>בדיקה ואישור</Link>}
              <RemoveReviewDocument id={document.id} />
            </div>
          </div>
        </Card>
      </li>)}</ul>
    </>}
    <Link className="text-primary underline" href="/upload">העלאת מסמכים נוספים</Link>
  </div>;
}
