"use client";
import { formatMoney } from "@/lib/currency/money";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { TransactionDrawer } from "./TransactionDrawer";
import { formatCurrencyILS, formatDateDDMMYYYY } from "@/lib/format";
import type { TransactionRow } from "@/types/db";
import type { Totals } from "@/lib/transactions/reporting";
export const COLUMNS = [["doc_date", "תאריך"], ["direction", "סוג"], ["counterparty_name", "שם הספק או הלקוח"], ["doc_number", "מספר מסמך"], ["category", "קטגוריה"], ["amount_before_vat", "לפני מע״מ"], ["vat_amount", "מע״מ"], ["amount_total", "סה״כ"], ["attachment", "קובץ מצורף"]] as const;
export function TotalsStrip({ totals }: { totals: Totals }): React.JSX.Element {
  return <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border bg-background p-3 text-sm" aria-label="סיכום התוצאות"><span className="text-income">סה״כ הכנסות: {formatCurrencyILS(totals.income)}</span><span className="text-expense">סה״כ הוצאות: {formatCurrencyILS(totals.expense)}</span><span>סה״כ מע״מ נטו: {formatCurrencyILS(totals.vat)}</span></div>;
}
export function TransactionResults({ rows, categories, totals, sort = "doc_date", ascending = false, sortBase }: { rows: TransactionRow[]; categories: Record<string, string>; totals?: Totals; sort?: string; ascending?: boolean; sortBase?: string }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return <>
    {rows.length === 0 ? <div className="rounded-xl border border-border p-8 text-center"><p className="mb-4">אין תנועות להצגה בטווח ובמסננים שבחרת.</p><Link href="/upload" className="text-primary underline">העלאת מסמך ראשון</Link></div> : <div className="max-h-[65vh] overflow-auto rounded-lg border border-border"><table className="w-full min-w-[960px] text-right text-sm"><caption className="sr-only">תנועות בטווח הנבחר. לחצי על שם הספק לפתיחת פרטים.</caption><thead className="sticky top-0 z-10 bg-background"><tr>{COLUMNS.map(([key, label]) => { const query = new URLSearchParams(sortBase); query.set("sort", key); query.set("order", sort === key && !ascending ? "asc" : "desc"); query.delete("page"); return <th key={key} className="whitespace-nowrap border-b border-border p-3" aria-sort={sort === key ? ascending ? "ascending" : "descending" : "none"}>{sortBase !== undefined ? <Link href={`/transactions?${query}`} scroll={false}>{label} {sort === key ? ascending ? "↑" : "↓" : "↕"}</Link> : label}</th>; })}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="cursor-pointer border-b border-border hover:bg-primary/5" onClick={() => setSelectedId(row.id)}><td className="whitespace-nowrap p-3">{formatDateDDMMYYYY(row.doc_date)}</td><td className="p-3"><Badge variant={row.direction}>{row.direction === "income" ? "הכנסה" : "הוצאה"}</Badge></td><td className="p-3"><button className="text-right text-primary underline focus-visible:outline-2" onClick={() => setSelectedId(row.id)}>{row.counterparty_name}</button>{row.currency_review_required&&<p className="text-warning">דרושה בדיקת מטבע</p>}</td><td className="p-3">{row.doc_number ?? "—"}</td><td className="p-3">{categories[row.category_id ?? ""] ?? "ללא קטגוריה"}</td>{[row.amount_before_vat, row.vat_amount, row.amount_total].map((amount, index) => <td key={index} className="whitespace-nowrap p-3">{row.currency_review_required?"טעון בדיקת מטבע":<>{formatCurrencyILS(amount)}{index===2&&row.amount_total_usd!==null&&<small className="block">{formatMoney(row.amount_total_usd,"USD")}</small>}{index===2&&<small className="block text-foreground/60">מקור: {row.currency==="USD"?"דולר":"שקל"}</small>}</>}</td>)}<td className="p-3">{row.document_id ? <span aria-label="יש מסמך מצורף">📎</span> : <span aria-label="אין מסמך מצורף">—</span>}</td></tr>)}</tbody></table></div>}
    {totals && <div className="sticky bottom-0 z-10"><TotalsStrip totals={totals} /></div>}
    {selectedId && <TransactionDrawer key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
  </>;
}
