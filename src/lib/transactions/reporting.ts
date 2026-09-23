import { getCurrentPeriod, summarize as calculateSummary, type Summary } from "@/lib/calc";
import type { ReportingFrequency, TransactionRow } from "@/types/db";
export type SearchValues = Record<string, string | string[] | undefined>;
export type Totals = { income: number; expense: number; vat: number; unverifiedCount: number; foreignCurrencyCount: number };
export function first(value: string | string[] | undefined): string { return typeof value === "string" ? value : ""; }
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function todayIsrael(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function monthRange(month: string): { start: string; end: string } {
  const {start,end}=getCurrentPeriod(`${month}-01`,"monthly");
  return {start,end};
}
export function resolveRange(params: SearchValues, frequency: ReportingFrequency, today = todayIsrael()): { start: string; end: string; preset: string } {
  const preset = first(params.preset) || "month";
  const year = Number(today.slice(0, 4)); const month = Number(today.slice(5, 7));
  if (preset === "custom") {
    const start = first(params.start); const end = first(params.end);
    if (!validDate(start) || !validDate(end) || start > end) throw new Error("יש לבחור טווח תאריכים תקין, מהתאריך המוקדם למאוחר.");
    return { start, end, preset };
  }
  if (preset === "year") return { start: `${year}-01-01`, end: `${year}-12-31`, preset };
  if (preset === "previous") {
    const date = new Date(Date.UTC(year, month - 2, 1));
    return { ...monthRange(date.toISOString().slice(0, 7)), preset };
  }
  if (preset === "period") { const {start,end}=getCurrentPeriod(today,frequency);return {start,end,preset}; }
  return { ...monthRange(today.slice(0, 7)), preset: preset === "period" ? "period" : "month" };
}
export function summarize(rows: readonly TransactionRow[]): Totals {
 const summary:Summary=calculateSummary(rows);
 return {income:summary.incomeTotal,expense:summary.expenseTotal,vat:summary.vatDue,unverifiedCount:summary.unverifiedCount,foreignCurrencyCount:summary.foreignCurrencyCount};
}
export function israelMidnight(date: string): string {
  // Resolve Jerusalem offset at local midnight, including summer/winter time.
  const utc = new Date(`${date}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(utc));
  return new Date(utc.getTime() - hour * 3600000).toISOString();
}

export function filterAndPage(rows: readonly TransactionRow[], params: SearchValues, names: Record<string, string>): { rows: TransactionRow[]; count: number; totals: Totals; pages: number; page: number; sort: string; ascending: boolean; direction: string; category: string; q: string } {
  const direction = ["income", "expense"].includes(first(params.direction)) ? first(params.direction) : "";
  const category = first(params.category); const q = first(params.q).trim().slice(0, 150);
  const filtered = rows.filter(row => (!direction || row.direction === direction) && (!category || row.category_id === category) && (!q || row.counterparty_name.toLocaleLowerCase().includes(q.toLocaleLowerCase()) || (row.doc_number ?? "").toLocaleLowerCase().includes(q.toLocaleLowerCase())));
  const totals = summarize(filtered);
  const allowed = ["doc_date", "direction", "counterparty_name", "doc_number", "category", "amount_before_vat", "vat_amount", "amount_total", "attachment"];
  const sort = allowed.includes(first(params.sort)) ? first(params.sort) : "doc_date"; const ascending = first(params.order) === "asc";
  function value(row: TransactionRow): string | number {
    if (sort === "category") return names[row.category_id ?? ""] ?? "";
    if (sort === "attachment") return row.document_id ? 1 : 0;
    if (sort === "direction") return row.direction === "income" ? "הכנסה" : "הוצאה";
    const result = row[sort as keyof TransactionRow]; return typeof result === "number" ? result : String(result ?? "");
  }
  filtered.sort((a, b) => { const av = value(a); const bv = value(b); const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "he", { numeric: true }); return (ascending ? comparison : -comparison) || a.id.localeCompare(b.id); });
  const pages = Math.max(1, Math.ceil(filtered.length / 50)); const requested = Number(first(params.page)); const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { rows: filtered.slice((page - 1) * 50, page * 50), count: filtered.length, totals, pages, page, sort, ascending, direction, category, q };
}
