import type { Comparison, Summary } from "@/lib/calc";

export const DASHBOARD_METRICS = [
    { id: "vatDue", label: "מע״מ לתשלום", tone: "text-primary", featured: true },
    { id: "incomeBeforeVat", label: "הכנסות לפני מע״מ", tone: "text-income", featured: false },
    { id: "expenseBeforeVat", label: "הוצאות לפני מע״מ", tone: "text-expense", featured: false },
    { id: "expenseTotal", label: "הוצאות כולל מע״מ", tone: "text-expense", featured: false },
    { id: "profitBeforeTax", label: "רווח לפני מס", tone: "text-foreground", featured: false },
] as const satisfies readonly { id: keyof Summary & keyof Comparison; label: string; tone: string; featured: boolean }[];
export type DashboardMetricId = (typeof DASHBOARD_METRICS)[number]["id"];
export const DEFAULT_METRICS: DashboardMetricId[] = DASHBOARD_METRICS.map(metric => metric.id);
export function isMetricSelection(value: unknown): value is DashboardMetricId[] {
    return Array.isArray(value) && value.length <= DASHBOARD_METRICS.length && value.every(id => typeof id === "string" && DASHBOARD_METRICS.some(metric => metric.id === id)) && new Set(value).size === value.length;
}
export function parseMetricSelection(value: string | undefined): DashboardMetricId[] {
    if (!value) return [...DEFAULT_METRICS];
    try { const parsed: unknown = JSON.parse(value); return isMetricSelection(parsed) ? parsed : [...DEFAULT_METRICS]; }
    catch { return [...DEFAULT_METRICS]; }
}
export function metricCookieName(userId: string): string { return `dashboard-metrics-${userId}`; }
