import Link from "next/link";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionResults } from "@/components/transactions/TransactionResults";
import { userContext, loadRange } from "@/lib/transactions/load-range";
import { filterAndPage, resolveRange, type SearchValues } from "@/lib/transactions/reporting";
import { formatDateDDMMYYYY } from "@/lib/format";
import type { TransactionRow } from "@/types/db";
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
  const params = await searchParams; const { supabase, userId } = await userContext();
  const [profile, categoriesResult] = await Promise.all([supabase.from("profiles").select("reporting_frequency").eq("id", userId).single(), supabase.from("categories").select("*").eq("user_id", userId).order("name")]);
  if (profile.error || categoriesResult.error) return <p role="alert">לא ניתן לטעון את ההגדרות. רענני את הדף ונסי שוב.</p>;
  const categories = categoriesResult.data ?? []; const names = Object.fromEntries(categories.map(category => [category.id, category.name]));
  let range: ReturnType<typeof resolveRange>;
  try { range = resolveRange(params, profile.data.reporting_frequency); } catch { return <div role="alert">טווח התאריכים אינו תקין. <Link href="/transactions" className="text-primary underline">חזרה למסננים</Link></div>; }
  let rows: TransactionRow[];
  try { rows = await loadRange(supabase, userId, range.start, range.end); } catch { return <p role="alert">לא ניתן לטעון את התנועות. רענני את הדף ונסי שוב.</p>; }
  const results = filterAndPage(rows, params, names);
  const { direction, category, q, totals, sort, ascending, page, pages } = results;
  const initial = { ...range, direction, category, q }; const base = new URLSearchParams(initial); base.set("sort", sort); base.set("order", ascending ? "asc" : "desc");
  const pageUrl = (number: number): string => { const query = new URLSearchParams(base); query.set("page", String(number)); return `/transactions?${query}`; };
  return <div className="flex min-w-0 flex-col gap-4"><header className="flex items-center justify-between"><h1 className="text-2xl font-bold">תנועות</h1><Link className="rounded bg-primary px-4 py-2 text-white" href="/transactions/new">תנועה חדשה</Link></header>
    {rows.some(row=>row.currency_review_required)&&<p role="alert" className="rounded border border-warning p-3">יש תנועות ישנות שדורשות בדיקת מטבע. הן מסומנות ברשימה ואינן נכללות בסיכומים עד לשמירה מחדש בעריכה.</p>}
    <TransactionFilters key={base.toString()} initial={initial} categories={categories} />
    <p className="text-sm text-foreground/70">{formatDateDDMMYYYY(range.start)} – {formatDateDDMMYYYY(range.end)} · {results.count} תנועות מאושרות. יתרת המע״מ היא מע״מ הכנסות פחות מע״מ הוצאות לפי אחוז ההכרה.</p>
    <TransactionResults key={base.toString() + page} rows={results.rows} categories={names} totals={totals} sort={sort} ascending={ascending} sortBase={base.toString()} />
    <nav aria-label="עמודי תנועות" className="flex justify-center gap-4">{page > 1 && <Link href={pageUrl(page - 1)} scroll={false}>הקודם</Link>}<span>עמוד {page} מתוך {pages}</span>{page < pages && <Link href={pageUrl(page + 1)} scroll={false}>הבא</Link>}</nav>
  </div>;
}
