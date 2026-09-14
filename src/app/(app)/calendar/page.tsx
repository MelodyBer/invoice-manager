import Link from "next/link";
import { MonthSelector } from "@/components/calendar/MonthSelector";
import { TransactionResults, TotalsStrip } from "@/components/transactions/TransactionResults";
import { userContext, loadRange } from "@/lib/transactions/load-range";
import { first, todayIsrael, validDate, monthRange, summarize, israelMidnight, type SearchValues } from "@/lib/transactions/reporting";
import { formatCurrencyILS, formatDateDDMMYYYY, HEBREW_MONTH_NAMES } from "@/lib/format";
import type { TransactionRow } from "@/types/db";
export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
  const params = await searchParams; const requested = first(params.month); const today = todayIsrael();
  const month = validDate(`${requested}-01`) && Number(requested.slice(0, 4)) >= 1900 && Number(requested.slice(0, 4)) <= 2200 ? requested : today.slice(0, 7);
  const range = monthRange(month); const [year, number] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7); const previousMonth = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
  const selected = validDate(first(params.day)) && first(params.day).startsWith(month) ? first(params.day) : today.startsWith(month) ? today : range.start;
  const { supabase, userId } = await userContext();
  let rows: TransactionRow[];
  try { rows = await loadRange(supabase, userId, range.start, range.end); } catch { return <p role="alert">לא ניתן לטעון את התאריכון. רענני את הדף ונסי שוב.</p>; }
  const [categoriesResult, docs] = await Promise.all([supabase.from("categories").select("id, name").eq("user_id", userId), supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("uploaded_at", israelMidnight(range.start)).lt("uploaded_at", israelMidnight(`${nextMonth}-01`))]);
  if (categoriesResult.error || docs.error) return <p role="alert">לא ניתן לטעון את הסיכום החודשי. נסי שוב.</p>;
  const categories = Object.fromEntries((categoriesResult.data ?? []).map(category => [category.id, category.name]));
  const days = new Map<string, TransactionRow[]>(); for (const row of rows) { const list = days.get(row.doc_date) ?? []; list.push(row); days.set(row.doc_date, list); }
  const leading = new Date(`${range.start}T12:00:00Z`).getUTCDay(); const count = Number(range.end.slice(8)); const totalCells = Math.ceil((leading + count) / 7) * 7;
  const selectedRows = days.get(selected) ?? []; const pages = Math.max(1, Math.ceil(selectedRows.length / 50)); const requestedPage = Number(first(params.page)); const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  return <div className="flex min-w-0 flex-col gap-4"><h1 className="text-2xl font-bold">תאריכון</h1><TotalsStrip totals={summarize(rows)} /><p className="text-sm">{docs.count ?? 0} מסמכים הועלו החודש. הסכומים לפי תאריך התנועות המאושרות; יתרת מע״מ שלילית היא יתרת זכות.</p>
    <div className="flex items-center justify-between gap-2"><Link aria-label="החודש הקודם" href={`/calendar?month=${previousMonth}`} className="rounded border border-border p-2">›</Link><MonthSelector month={month} /><Link aria-label="החודש הבא" href={`/calendar?month=${nextMonth}`} className="rounded border border-border p-2">‹</Link></div>
    <h2 className="sr-only">{HEBREW_MONTH_NAMES[number - 1]} {year}</h2>
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border" dir="rtl">{["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map(day => <div key={day} className="bg-foreground/5 py-2 text-center text-xs sm:text-sm">{day}</div>)}
      {Array.from({ length: totalCells }, (_, cell) => { const day = cell - leading + 1; if (day < 1 || day > count) return <div key={cell} className="min-h-20 border-t border-border bg-foreground/5" />;
        const date = `${month}-${String(day).padStart(2, "0")}`; const entries = days.get(date) ?? []; const totals = summarize(entries); const income = entries.some(row => row.direction === "income"); const expense = entries.some(row => row.direction === "expense");
        return <Link key={cell} href={`/calendar?month=${month}&day=${date}#day-transactions`} scroll={false} aria-label={`${formatDateDDMMYYYY(date)}, ${entries.length} תנועות${income ? `, הכנסות ${formatCurrencyILS(totals.income)}` : ""}${expense ? `, הוצאות ${formatCurrencyILS(totals.expense)}` : ""}`} aria-current={selected === date ? "date" : undefined} className={`min-h-24 min-w-0 border-t border-border p-1 text-center focus-visible:outline-2 focus-visible:outline-primary sm:p-2 ${selected === date ? "bg-primary/15 ring-2 ring-inset ring-primary" : entries.length ? "bg-primary/5" : ""}`}><span className={`inline-block text-sm ${date === today ? "font-bold underline" : ""}`}>{day}</span><div className="mt-2 text-[9px] leading-4 sm:text-xs"><span className="block truncate text-income" title={formatCurrencyILS(totals.income)}>{income ? formatCurrencyILS(totals.income) : ""}</span><span className="block truncate text-expense" title={formatCurrencyILS(totals.expense)}>{expense ? formatCurrencyILS(totals.expense) : ""}</span></div></Link>;
      })}
    </div>
    <section id="day-transactions" className="flex min-w-0 flex-col gap-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">תנועות ב־{formatDateDDMMYYYY(selected)}</h2><Link className="text-primary underline" href={`/transactions/new?date=${selected}`}>הוסף תנועה בתאריך זה</Link></div><TransactionResults key={`${selected}-${page}`} rows={selectedRows.slice((page - 1) * 50, page * 50)} categories={categories} />{pages > 1 && <nav className="flex gap-4" aria-label="עמודי תנועות היום">{page > 1 && <Link href={`/calendar?month=${month}&day=${selected}&page=${page - 1}`} scroll={false}>הקודם</Link>}<span>עמוד {page} מתוך {pages}</span>{page < pages && <Link href={`/calendar?month=${month}&day=${selected}&page=${page + 1}`} scroll={false}>הבא</Link>}</nav>}</section>
  </div>;
}
