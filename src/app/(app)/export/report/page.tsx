import { userContext } from "@/lib/transactions/load-range";
import { resolveExportRange } from "@/lib/export/range";
import { loadExportData } from "@/lib/export/load-export-data";
import { todayIsrael, type SearchValues } from "@/lib/transactions/reporting";
import { PrintReport } from "@/components/export/PrintReport";
import { PrintOnLoad } from "@/components/export/PrintOnLoad";

export default async function ExportReportPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
  const params = await searchParams;
  const { supabase, userId } = await userContext();
  const profile = await supabase.from("profiles").select("reporting_frequency").eq("id", userId).single();
  if (profile.error || !profile.data) return <p role="alert">לא ניתן לטעון את ההגדרות. רענני ונסי שוב.</p>;

  let range: ReturnType<typeof resolveExportRange>;
  try {
    range = resolveExportRange(params, profile.data.reporting_frequency);
  } catch {
    return <p role="alert">טווח התאריכים אינו תקין.</p>;
  }

  let data: Awaited<ReturnType<typeof loadExportData>>;
  try {
    data = await loadExportData(supabase, userId, range);
  } catch {
    return <p role="alert">לא ניתן לטעון את הנתונים לדוח. רענני ונסי שוב.</p>;
  }

  return (
    <>
      <style>{`
        body { background: #fff; }
        .report { max-width: 800px; margin: 0 auto; padding: 16px; color: #111; }
        .report-header { margin-bottom: 24px; }
        .report-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
        .report-header p { margin: 2px 0; color: #444; }
        .report-period { font-weight: 600; }
        section { margin-bottom: 24px; }
        section h2 { font-size: 1.05rem; font-weight: 700; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; }
        thead th, tfoot th { background: #f2f2f2; }
        tbody tr:nth-child(even) { background: #fafafa; }
        .report-footer { margin-top: 32px; font-size: 0.75rem; color: #666; text-align: center; }
        @page { size: A4; margin: 14mm; }
        @media screen { .report { border: 1px solid #ddd; margin-top: 24px; } }
      `}</style>
      <PrintOnLoad />
      <PrintReport data={data} generatedAt={todayIsrael()} />
    </>
  );
}
