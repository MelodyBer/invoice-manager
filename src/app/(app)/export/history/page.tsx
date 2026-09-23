import Link from "next/link";
import { userContext } from "@/lib/transactions/load-range";
import { formatDateDDMMYYYY, formatCentsILS } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui";

function snapshotNumber(snapshot: Record<string, unknown> | null, path: readonly string[]): number | null {
  let value: unknown = snapshot;
  for (const key of path) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === "number" ? value : null;
}

function snapshotLabel(snapshot: Record<string, unknown> | null): string | null {
  const value = snapshot?.label;
  return typeof value === "string" ? value : null;
}

export default async function ExportHistoryPage(): Promise<React.JSX.Element> {
  const { supabase, userId } = await userContext();
  const { data, error } = await supabase.from("periods").select("*").eq("user_id", userId).eq("status", "closed").order("period_start", { ascending: false });
  if (error) return <p role="alert">לא ניתן לטעון את היסטוריית הייצואים. רענני ונסי שוב.</p>;
  const periods = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">היסטוריית ייצואים</h1>
        <Link href="/export" className="text-primary underline">חזרה לייצוא</Link>
      </header>

      {periods.length === 0 ? (
        <EmptyState title="עדיין לא הוגשה אף תקופה" description="אחרי ייצוא תקופת דיווח אפשר לסמן אותה כהוגשה, והיא תופיע כאן." />
      ) : (
        <div className="flex flex-col gap-3">
          {periods.map(period => {
            const transactionCount = snapshotNumber(period.snapshot, ["transactionCount"]);
            const vatDue = snapshotNumber(period.snapshot, ["summary", "vatDue"]);
            const label = snapshotLabel(period.snapshot);
            return (
              <Card key={period.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{label ?? `${formatDateDDMMYYYY(period.period_start)} – ${formatDateDDMMYYYY(period.period_end)}`}</p>
                    <p className="text-sm text-foreground/60">
                      {formatDateDDMMYYYY(period.period_start)} – {formatDateDDMMYYYY(period.period_end)}
                      {period.submitted_at ? ` · הוגשה ב-${formatDateDDMMYYYY(period.submitted_at.slice(0, 10))}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm text-foreground/70">
                    {transactionCount !== null && <span>{transactionCount} תנועות</span>}
                    {vatDue !== null && <span>מע״מ לתשלום: {formatCentsILS(vatDue)}</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
