import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CategoryRow, DocumentRow, ProfileRow, TransactionRow } from "@/types/db";
import { compareToPrevious, getDashboardWindow, summarize, summarizeMonths, type Comparison, type DashboardPreset, type DashboardWindow, type MonthlySummary, type Summary } from "@/lib/calc";
import { loadRange } from "@/lib/transactions/load-range";
import { first, israelMidnight, todayIsrael, type SearchValues } from "@/lib/transactions/reporting";
import { loadReviewQueue } from "@/lib/transactions/review-queue";

export interface DashboardData {
    profile: ProfileRow;
    window: DashboardWindow;
    totals: Summary;
    comparison: Comparison;
    chart: MonthlySummary[];
    categories: Pick<CategoryRow, "id" | "name">[];
    latest: TransactionRow[];
    documents: DocumentRow[];
    uncategorized: TransactionRow[];
    invalidDeduction: TransactionRow[];
    isFirstVisit: boolean;
}
export async function loadDashboard(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, params: SearchValues, today: string = todayIsrael()): Promise<DashboardData> {
    const profileResult = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (profileResult.error || !profileResult.data) throw new Error("לא ניתן לטעון את פרטי העסק. רענני ונסי שוב.");
    const profile = profileResult.data;
    const rawPreset = first(params.preset) || "period";
    const preset: DashboardPreset = rawPreset === "month" || rawPreset === "year" || rawPreset === "custom" ? rawPreset : "period";
    const window = getDashboardWindow(today, profile.reporting_frequency, preset, first(params.start), first(params.end));
    const [rows, previousRows, chartRows, categoryResult, existence, documents] = await Promise.all([
        loadRange(supabase, userId, window.selected.start, window.selected.end),
        loadRange(supabase, userId, window.previous.start, window.previous.end),
        loadRange(supabase, userId, window.months[0].start, window.chartThrough),
        supabase.from("categories").select("id, name").eq("user_id", userId).order("name"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
        loadReviewQueue(supabase, userId, { start: israelMidnight(window.selected.start), endExclusive: israelMidnight(window.endExclusive) }),
    ]);
    if (categoryResult.error || existence.error) throw new Error("לא ניתן לטעון את הדשבורד. רענני ונסי שוב.");
    const options = { incomeTaxAdvanceRate: profile.income_tax_advance_rate, taxReserveRate: profile.tax_reserve_rate };
    const totals = summarize(rows, options);
    return {
        profile, window, totals, comparison: compareToPrevious(totals, summarize(previousRows, options)),
        chart: summarizeMonths(chartRows, window.months, window.chartThrough), categories: categoryResult.data ?? [],
        latest: [...rows].sort((a, b) => b.doc_date.localeCompare(a.doc_date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).slice(0, 5),
        documents, uncategorized: rows.filter(row => row.category_id === null),
        invalidDeduction: rows.filter(row => row.direction === "expense" && row.vat_deductible_percent > 0 && !["invoice_tax", "invoice_tax_receipt"].includes(row.doc_type)),
        isFirstVisit: existence.count === 0,
    };
}
