"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlySummary } from "@/lib/calc";
import { formatCentsILS, formatCompactCentsILS } from "@/lib/format";
export function MonthlyChart({ data }: { data: MonthlySummary[] }): React.JSX.Element {
    return <>
        <div className="mb-4 flex gap-5 text-sm"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-income" />הכנסות</span><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-expense" />הוצאות</span></div>
        <div className="h-72 min-w-0 sm:h-80" dir="ltr" role="img" aria-label="הכנסות מול הוצאות לפי חודש, לפני מע״מ. הנתונים זמינים גם בטבלה בהמשך.">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 288 }}>
                <BarChart data={data} accessibilityLayer margin={{ top: 10, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" reversed tick={{ fill: "var(--foreground)", fontSize: 11 }} minTickGap={18} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value: number): string => formatCompactCentsILS(value)} tick={{ fill: "var(--foreground)", fontSize: 11 }} width={70} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => typeof value === "number" ? formatCentsILS(value) : "—"} contentStyle={{ direction: "rtl", backgroundColor: "var(--background)", borderColor: "var(--border)", borderRadius: 12, color: "var(--foreground)" }} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
                    <Bar dataKey="income" name="הכנסות" fill="var(--income)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="expense" name="הוצאות" fill="var(--expense)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">הצגת נתוני הגרף בטבלה</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-right tabular-nums"><caption className="sr-only">הכנסות והוצאות לפני מע״מ לפי חודש</caption><thead><tr><th className="p-2">חודש</th><th className="p-2">הכנסות</th><th className="p-2">הוצאות</th></tr></thead><tbody>{data.map(month => <tr key={month.month} className="border-t border-border"><th scope="row" className="p-2 font-normal">{month.label}</th><td className="p-2">{formatCentsILS(month.income)}</td><td className="p-2">{formatCentsILS(month.expense)}</td></tr>)}</tbody></table></div></details>
    </>;
}
