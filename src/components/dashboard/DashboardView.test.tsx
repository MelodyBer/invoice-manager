import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDashboardWindow, summarize, compareToPrevious, summarizeMonths } from "@/lib/calc";
import type { DashboardData } from "@/lib/dashboard/load-dashboard";
import { DashboardView } from "./DashboardView";
vi.mock("@/lib/dashboard/metric-actions", () => ({ saveDashboardMetrics: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
function fixture(): DashboardData {
    const window = getDashboardWindow("2026-09-23", "bimonthly");
    const rows = [{ direction: "income" as const, amount_before_vat: 45000, amount_total: 53100, vat_amount: 8100, vat_deductible_percent: 100, currency: "ILS", category_id: null, is_verified: true, doc_date: "2026-09-01" }, { direction: "expense" as const, amount_before_vat: 12500, amount_total: 14750, vat_amount: 2250, vat_deductible_percent: 100, currency: "ILS", category_id: "office", is_verified: true, doc_date: "2026-09-02" }];
    const totals = summarize(rows, { incomeTaxAdvanceRate: 5, taxReserveRate: 30 });
    return { profile: { id: "demo", business_name: "העסק לדוגמה", business_number: null, vat_rate: 18, reporting_frequency: "bimonthly", income_tax_advance_rate: 5, tax_reserve_rate: 30, created_at: "2026-01-01" }, window, totals, comparison: compareToPrevious(totals, summarize([])), chart: summarizeMonths(rows, window.months, window.chartThrough), categories: [{ id: "office", name: "משרד ומחשוב" }], latest: [], documents: [], uncategorized: [], invalidDeduction: [], isFirstVisit: false };
}
describe("dashboard server-rendered presentation", () => {
    it("includes values, period, graph data table and scoped links in initial HTML", () => {
        const html = renderToStaticMarkup(<DashboardView data={fixture()} />);
        expect(html).toContain("שלום, העסק לדוגמה");
        expect(html).toContain("5,850.00");
        expect(html).toContain("45,000.00");
        expect(html).toContain("אין בסיס להשוואה");
        expect(html).toContain("הצגת נתוני הגרף בטבלה");
        expect(html).toContain("start=2026-09-01&amp;end=2026-10-31");
        expect(html).not.toContain("דורש טיפול");
        // Optional local-only preview containing synthetic data, never account data.
        const preview = process.env.DASHBOARD_PREVIEW_DIR;
        if (preview) {
            mkdirSync(preview, { recursive: true });
            const cssDirectory = join(process.cwd(), ".next/static/chunks");
            const css = readdirSync(cssDirectory).filter(file => file.endsWith(".css")).map(file => readFileSync(join(cssDirectory, file), "utf8")).join("\n");
            writeFileSync(join(preview, "index.html"), `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body style="font-family:Arial,sans-serif"><main style="max-width:1400px;margin:auto;padding:24px">${html}</main></body></html>`);
        }
    });
    it("uses gross expense totals and respects hidden cards in server HTML", () => {
        const data = fixture();
        const html = renderToStaticMarkup(<DashboardView data={data} selectedMetrics={["expenseTotal"]} />);
        expect(html).toContain("14,750.00");
        expect(html).not.toContain('text-xs font-medium text-foreground/70 sm:text-sm">הוצאות לפני מע״מ</h2>');
        expect(html).toContain('text-xs font-medium text-foreground/70 sm:text-sm">הוצאות כולל מע״מ</h2>');
    });
    it("renders a refund and warnings for unverified and foreign rows", () => {
        const data = fixture();
        data.totals = { ...data.totals, vatDue: -1800, unverifiedCount: 1, foreignCurrencyCount: 2 };
        const html = renderToStaticMarkup(<DashboardView data={data} />);
        expect(html).toContain("החזר מע״מ צפוי");
        expect(html).toContain("18.00");
        expect(html).toContain("תנועות שטרם אושרו");
        expect(html).toContain("תנועות במטבע זר");
    });
    it("renders onboarding only for an account without any transactions", () => {
        const data = fixture(); data.isFirstVisit = true;
        const html = renderToStaticMarkup(<DashboardView data={data} />);
        expect(html).toContain("העלאת המסמך הראשון");
        expect(html).not.toContain("5 התנועות האחרונות");
    });
});
