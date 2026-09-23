import Link from "next/link";
import { userContext } from "@/lib/transactions/load-range";
import { resolveExportRange } from "@/lib/export/range";
import { loadExportData } from "@/lib/export/load-export-data";
import { ExportFilters } from "@/components/export/ExportFilters";
import { ExportButtons } from "@/components/export/ExportButtons";
import { SubmitPeriodButton } from "@/components/export/SubmitPeriodButton";
import { Card } from "@/components/ui";
import { formatCentsILS, formatDateDDMMYYYY } from "@/lib/format";
import { todayIsrael, first, type SearchValues } from "@/lib/transactions/reporting";

export default async function ExportPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
  const params = await searchParams;
  const { supabase, userId } = await userContext();
  const profile = await supabase.from("profiles").select("reporting_frequency").eq("id", userId).single();
  if (profile.error || !profile.data) return <p role="alert">לא ניתן לטעון את ההגדרות. רענני את הדף ונסי שוב.</p>;

  let range: ReturnType<typeof resolveExportRange>;
  try {
    range = resolveExportRange(params, profile.data.reporting_frequency);
  } catch {
    return <div role="alert">טווח התאריכים אינו תקין. <Link href="/export" className="text-primary underline">חזרה למסננים</Link></div>;
  }

  let data: Awaited<ReturnType<typeof loadExportData>>;
  try {
    data = await loadExportData(supabase, userId, range);
  } catch {
    return <p role="alert">לא ניתן לטעון את הנתונים לייצוא. רענני את הדף ונסי שוב.</p>;
  }

  const submittedResult = range.preset === "period"
    ? await supabase.from("periods").select("status").eq("user_id", userId).eq("period_start", range.start).eq("period_end", range.end).eq("status", "closed").maybeSingle()
    : null;
  const alreadySubmitted = Boolean(submittedResult?.data);

  const today = todayIsrael();
  const filterInitial = { preset: range.preset, date: first(params.date) || today, start: first(params.start) || range.start, end: first(params.end) || range.end };
  const query = new URLSearchParams({ preset: range.preset, start: range.start, end: range.end }).toString();
  const { summary } = data;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ייצוא לרו״ח</h1>
        <Link href="/export/history" className="text-sm text-primary underline">היסטוריית ייצואים</Link>
      </header>

      <ExportFilters key={`${range.preset}-${range.start}-${range.end}`} initial={filterInitial} />

      <p className="text-sm text-foreground/70">{range.label} · {formatDateDDMMYYYY(range.start)} – {formatDateDDMMYYYY(range.end)}</p>

      {data.currencyReviewCount > 0 && (
        <p role="alert" className="rounded border border-warning p-3 text-warning">
          יש {data.currencyReviewCount} תנועות שדורשות בדיקת מטבע בטווח הזה. הן אינן נכללות בייצוא עד לתיקון. <Link href="/transactions" className="underline">מעבר לתנועות</Link>
        </p>
      )}
      {summary.foreignCurrencyCount > 0 && (
        <p role="status" className="rounded border border-border p-3 text-sm">כולל {summary.foreignCurrencyCount} תנועות במטבע זר, מוצגות בהמרה לשקלים לפי שער בנק ישראל.</p>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">תצוגה מקדימה</h2>
        {data.rows.length === 0 ? (
          <p className="text-foreground/70">אין תנועות לייצוא בטווח שנבחר.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-sm text-foreground/60">מספר תנועות</dt><dd className="text-xl font-semibold">{data.rows.length}</dd></div>
            <div><dt className="text-sm text-foreground/60">סה״כ הכנסות</dt><dd className="text-xl font-semibold text-income">{formatCentsILS(summary.incomeTotal)}</dd></div>
            <div><dt className="text-sm text-foreground/60">סה״כ הוצאות</dt><dd className="text-xl font-semibold text-expense">{formatCentsILS(summary.expenseTotal)}</dd></div>
            <div><dt className="text-sm text-foreground/60">מע״מ לתשלום</dt><dd className="text-xl font-semibold">{formatCentsILS(summary.vatDue)}</dd></div>
          </dl>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">ייצוא</h2>
        <ExportButtons query={query} hasRows={data.rows.length > 0} hasDocuments={data.documents.length > 0} />
      </Card>

      {range.preset === "period" && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">הגשת התקופה</h2>
          {alreadySubmitted ? (
            <p role="status" className="text-foreground/70">התקופה הזו כבר סומנה כהוגשה.</p>
          ) : (
            <SubmitPeriodButton params={{ preset: range.preset, date: filterInitial.date }} />
          )}
        </Card>
      )}
    </div>
  );
}
