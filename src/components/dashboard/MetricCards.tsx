"use client";
import { useState, useTransition } from "react";
import type { Comparison, Summary } from "@/lib/calc";
import { formatCentsILS } from "@/lib/format";
import { Button } from "@/components/ui";
import { DASHBOARD_METRICS, DEFAULT_METRICS, type DashboardMetricId } from "@/lib/dashboard/metrics";
import { saveDashboardMetrics } from "@/lib/dashboard/metric-actions";
function Change({ value }: { value: number | null }): React.JSX.Element {
    if (value === null) return <p className="mt-3 text-xs text-foreground/60">אין בסיס להשוואה — התקופה הקודמת אפס</p>;
    return <p className="mt-3 text-sm text-foreground/70"><span aria-hidden="true">{value > 0 ? "↑" : value < 0 ? "↓" : "↔"}</span> {value === 0 ? "ללא שינוי" : `${value > 0 ? "עלייה" : "ירידה"} של ${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(Math.abs(value))}%`} <span className="text-xs">מול התקופה הקודמת</span></p>;
}
export function MetricCards({ totals, comparison, initialSelection }: { totals: Summary; comparison: Comparison; initialSelection: DashboardMetricId[] }): React.JSX.Element {
    const [selected, setSelected] = useState<DashboardMetricId[]>(initialSelection);
    const [message, setMessage] = useState("");
    const [pending, startTransition] = useTransition();
    function toggle(id: DashboardMetricId): void {
        setMessage("");
        setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    }
    function save(): void {
        startTransition(async () => {
            try { const result = await saveDashboardMetrics(selected); setMessage(result.message); }
            catch { setMessage("לא ניתן לשמור את התצוגה. נסי שוב."); }
        });
    }
    return <section aria-label="מדדי העסק" className="space-y-4">
        <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium text-primary">בחירת מדדים לתצוגה</summary><p className="mt-2 text-sm text-foreground/60">בחרי אילו כרטיסים להציג. הבחירה נשמרת למשתמש שלך בדפדפן הזה.</p><fieldset disabled={pending} className="my-4 flex flex-wrap gap-x-6 gap-y-3"><legend className="sr-only">כרטיסי הדשבורד</legend>{DASHBOARD_METRICS.map(metric => <label key={metric.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(metric.id)} onChange={() => toggle(metric.id)} className="h-4 w-4 accent-primary" />{metric.label}</label>)}</fieldset><div className="flex flex-wrap gap-3"><Button onClick={save} isLoading={pending}>שמור תצוגה</Button><Button variant="secondary" disabled={pending} onClick={() => { setSelected([...DEFAULT_METRICS]); setMessage(""); }}>הצג את כל המדדים</Button></div><p role="status" className="mt-2 text-sm">{message}</p></details>
        {selected.length === 0 ? <p className="rounded-xl bg-primary/5 p-4 text-sm">לא נבחרו כרטיסים. אפשר להוסיף אותם דרך „בחירת מדדים לתצוגה”.</p> : <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{DASHBOARD_METRICS.filter(metric => selected.includes(metric.id)).map(metric => {
            const refund = metric.id === "vatDue" && totals.vatDue < 0;
            const tone = refund ? "text-income" : metric.id === "profitBeforeTax" && totals.profitBeforeTax < 0 ? "text-expense" : metric.tone;
            return <section key={metric.id} className={`min-w-0 rounded-2xl border border-border bg-background p-5 sm:p-6 ${metric.featured ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : ""}`}><h2 className="text-sm font-medium text-foreground/70">{refund ? "החזר מע״מ צפוי" : metric.label}</h2><p className={`mt-3 break-words text-3xl font-bold tracking-tight ${tone}`} dir="ltr">{formatCentsILS(refund ? Math.abs(totals.vatDue) : totals[metric.id])}</p>{metric.id === "expenseTotal" && <p className="mt-2 text-xs text-foreground/60">סכום מסמכי ההוצאה, כולל מע״מ כשיש. אינו בהכרח סכום ששולם בפועל.</p>}<Change value={comparison[metric.id]} /></section>;
        })}</div>}
    </section>;
}
