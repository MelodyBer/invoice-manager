import { formatCompactCentsILS } from "@/lib/format";
import { describe, expect, it, vi } from "vitest";
import { getDashboardWindow, summarizeMonths, type CalcTransaction } from "@/lib/calc";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/transactions/load-range", () => ({ loadRange: vi.fn() }));
vi.mock("@/lib/transactions/review-queue", () => ({ loadReviewQueue: vi.fn() }));
import { loadRange } from "@/lib/transactions/load-range";
import { loadReviewQueue } from "@/lib/transactions/review-queue";
import { loadDashboard } from "./load-dashboard";
import type { ProfileRow, TransactionRow } from "@/types/db";

const profile: ProfileRow = { id: "owner", business_name: "עסק לדוגמה", business_number: null, vat_rate: 18, reporting_frequency: "bimonthly", income_tax_advance_rate: 5, tax_reserve_rate: 30, created_at: "2026-01-01" };
function row(patch: Partial<TransactionRow> = {}): TransactionRow {
    return { id: "expense", user_id: "owner", document_id: null, direction: "expense", counterparty_name: "ספק", doc_number: null, doc_type: "invoice_tax", doc_date: "2026-09-01", amount_before_vat: 100, vat_amount: 18, amount_total: 118, vat_rate: 18, vat_deductible_percent: 100, category_id: null, currency: "ILS", notes: null, is_verified: true, created_at: "2026-09-01", updated_at: "2026-09-01", original_amount_before_vat: null, original_vat_amount: null, original_amount_total: null, amount_total_usd: null, exchange_rate: null, exchange_rate_date: null, currency_review_required: false, ...patch };
}
function client(count: number, failure = false): { value: Parameters<typeof loadDashboard>[0]; scopes: string[][] } {
    const scopes: string[][] = [];
    const value = { from(table: string) {
        const response = table === "profiles" ? { data: profile, error: failure ? { message: "private database error" } : null } : table === "categories" ? { data: [{ id: "c", name: "משרד" }], error: null } : { data: null, count, error: null };
        const query = { select: () => query, eq: (column: string, owner: string) => { scopes.push([table, column, owner]); return query; }, order: () => query, single: () => Promise.resolve(response), then: Promise.resolve(response).then.bind(Promise.resolve(response)) };
        return query;
    } };
    return { value: value as unknown as Parameters<typeof loadDashboard>[0], scopes };
}
describe("dashboard windows", () => {
    it("uses Hebrew compact currency labels", () => { expect(formatCompactCentsILS(1500000)).toContain("אלף"); expect(formatCompactCentsILS(1500000)).not.toContain("K"); });
    it("default reporting window, previous period and days remaining", () => {
        const value = getDashboardWindow("2026-09-23", "bimonthly");
        expect(value.selected).toMatchObject({ start: "2026-09-01", end: "2026-10-31", name: "ספטמבר–אוקטובר 2026" });
        expect(value.previous).toMatchObject({ start: "2026-07-01", end: "2026-08-31" });
        expect(value.daysRemaining).toBe(38);
        expect(value.endExclusive).toBe("2026-11-01");
        expect(value.months).toHaveLength(12);
    });
    it("monthly, leap-year, year-boundary and annual comparison", () => {
        expect(getDashboardWindow("2024-03-15", "monthly").previous.end).toBe("2024-02-29");
        expect(getDashboardWindow("2026-01-01", "bimonthly").previous.start).toBe("2025-11-01");
        expect(getDashboardWindow("2026-09-23", "bimonthly", "month").previous.start).toBe("2026-08-01");
        expect(getDashboardWindow("2024-02-29", "bimonthly", "year").previous).toEqual({ start: "2023-01-01", end: "2023-12-31", name: "שנת 2023" });
    });
    it("custom comparison is immediately preceding and equal length across DST", () => {
        const value = getDashboardWindow("2026-09-23", "bimonthly", "custom", "2026-03-25", "2026-03-30");
        expect(value.previous).toMatchObject({ start: "2026-03-19", end: "2026-03-24" });
        expect(value.daysRemaining).toBe(0);
        expect(value.months[11].start).toBe("2026-03-01");
    });
    it("rejects invalid or reversed dates", () => {
        expect(() => getDashboardWindow("2026-09-23", "monthly", "custom", "2026-02-30", "2026-03-01")).toThrow();
        expect(() => getDashboardWindow("2026-09-23", "monthly", "custom", "2026-04-01", "2026-03-01")).toThrow();
    });
    it("chart delegates to summary with zero months, converted FX and end-date cutoff", () => {
        const window = getDashboardWindow("2026-09-23", "monthly", "custom", "2026-09-01", "2026-09-15");
        const rows: (CalcTransaction & { doc_date: string })[] = [row(), row({ direction: "income", currency: "USD", amount_before_vat: 300 }), row({ doc_date: "2026-09-16" })];
        const points = summarizeMonths(rows, window.months, window.selected.end);
        expect(points).toHaveLength(12);
        expect(points[0]).toMatchObject({ income: 0, expense: 0 });
        expect(points[11]).toMatchObject({ income: 30000, expense: 10000 });
    });
});
describe("dashboard server data", () => {
    it("scopes every fetch, applies profile rates and keeps categories/issues/latest in selected period", async () => {
        const db = client(2);
        vi.mocked(loadRange).mockReset();
        vi.mocked(loadRange).mockResolvedValueOnce([row(), row({ id: "income", direction: "income", amount_before_vat: 1000, vat_amount: 180, amount_total: 1180, doc_date: "2026-09-20", category_id: "c" }), row({ id: "receipt", doc_type: "receipt", category_id: "c" })]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        vi.mocked(loadReviewQueue).mockResolvedValue([]);
        const data = await loadDashboard(db.value, "owner", {}, "2026-09-23");
        expect(data.totals.taxAdvance).toBe(5000);
        expect(data.totals.taxReserve).toBe(24000);
        expect(data.comparison.incomeBeforeVat).toBeNull();
        expect(data.uncategorized.map(item => item.id)).toEqual(["expense"]);
        expect(data.invalidDeduction.map(item => item.id)).toEqual(["receipt"]);
        expect(data.latest[0].id).toBe("income");
        expect(db.scopes).toEqual([["profiles", "id", "owner"], ["categories", "user_id", "owner"], ["transactions", "user_id", "owner"]]);
        expect(loadRange).toHaveBeenNthCalledWith(1, db.value, "owner", "2026-09-01", "2026-10-31");
        expect(loadRange).toHaveBeenNthCalledWith(2, db.value, "owner", "2026-07-01", "2026-08-31");
        expect(loadRange).toHaveBeenNthCalledWith(3, db.value, "owner", "2025-10-01", "2026-09-23");
        expect(loadReviewQueue).toHaveBeenLastCalledWith(db.value, "owner", { start: "2026-08-31T21:00:00.000Z", endExclusive: "2026-10-31T22:00:00.000Z" });
        expect(data.isFirstVisit).toBe(false);
    });
    it("distinguishes a new account from an empty selected period", async () => {
        vi.mocked(loadRange).mockResolvedValue([]); vi.mocked(loadReviewQueue).mockResolvedValue([]);
        expect((await loadDashboard(client(0).value, "owner", {}, "2026-09-23")).isFirstVisit).toBe(true);
        expect((await loadDashboard(client(20).value, "owner", {}, "2026-09-23")).isFirstVisit).toBe(false);
    });
    it("does not disguise errors as zero values or leak database details", async () => {
        await expect(loadDashboard(client(0, true).value, "owner", {}, "2026-09-23")).rejects.toThrow("לא ניתן לטעון את פרטי העסק");
        vi.mocked(loadRange).mockRejectedValueOnce(new Error("לא ניתן לטעון את התנועות"));
        await expect(loadDashboard(client(2).value, "owner", {}, "2026-09-23")).rejects.toThrow("לא ניתן לטעון את התנועות");
    });
});
