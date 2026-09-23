import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
vi.mock("server-only", () => ({}));
import { buildExportWorkbook } from "./build-workbook";
import type { ExportData } from "./load-export-data";
import type { ProfileRow, TransactionRow } from "@/types/db";

function transaction(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    original_amount_before_vat: null, original_vat_amount: null, original_amount_total: null, amount_total_usd: null, exchange_rate: null, exchange_rate_date: null,
    currency_review_required: false, id: "t1", user_id: "u1", document_id: null, direction: "expense", counterparty_name: "ספק בדיקה",
    doc_number: "123", doc_type: "invoice_tax", doc_date: "2026-03-05", amount_before_vat: 100, vat_amount: 18, amount_total: 118,
    vat_rate: 18, vat_deductible_percent: 100, category_id: null, currency: "ILS", notes: null, is_verified: true,
    created_at: "2026-03-05T00:00:00Z", updated_at: "2026-03-05T00:00:00Z", ...overrides,
  };
}

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return { id: "u1", business_name: "העסק שלי", business_number: "123456789", vat_rate: 18, reporting_frequency: "bimonthly", income_tax_advance_rate: 0, tax_reserve_rate: 30, created_at: "2026-01-01T00:00:00Z", ...overrides };
}

describe("buildExportWorkbook", () => {
  it("produces a readable workbook with the three expected sheets and correct totals", () => {
    const rows: TransactionRow[] = [
      transaction({ id: "e1", direction: "expense", amount_before_vat: 100, vat_amount: 18, amount_total: 118, vat_deductible_percent: 100 }),
      transaction({ id: "e2", direction: "expense", amount_before_vat: 50, vat_amount: 9, amount_total: 59, vat_deductible_percent: 66 }),
      transaction({ id: "i1", direction: "income", counterparty_name: "לקוח בדיקה", amount_before_vat: 200, vat_amount: 36, amount_total: 236 }),
    ];
    const data: ExportData = {
      profile: profile(), range: { start: "2026-03-01", end: "2026-04-30", preset: "period", label: "מרץ–אפריל 2026" },
      rows, categoryNames: {}, businessNumbers: { e1: "987654321" },
      summary: { incomeBeforeVat: 20000, outputVat: 3600, expenseBeforeVat: 15000, inputVat: 2394, vatDue: 1206, profitBeforeTax: 5000, taxAdvance: 0, taxReserve: 1500, countIncome: 1, countExpense: 2, incomeTotal: 23600, expenseTotal: 17700, unverifiedCount: 0, foreignCurrencyCount: 0, currencyReviewCount: 0, byCategory: [] },
      documents: [], currencyReviewCount: 0,
    };
    const buffer = buildExportWorkbook(data);
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // xlsx is a zip archive

    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["הוצאות", "הכנסות", "סיכום"]);

    const expenseRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["הוצאות"]);
    expect(expenseRows).toHaveLength(3); // 2 data rows + 1 totals row (blank separator row is dropped by sheet_to_json)
    expect(expenseRows[0]["שם ספק"]).toBe("ספק בדיקה");
    expect(expenseRows[0]["מספר עוסק"]).toBe("987654321");
    const expenseTotals = expenseRows[2];
    expect(expenseTotals["סכום לפני מע״מ"]).toBeCloseTo(150);
    expect(expenseTotals["סה״כ"]).toBeCloseTo(177);

    const incomeRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["הכנסות"]);
    expect(incomeRows).toHaveLength(2);
    expect(incomeRows[1]["סה״כ"]).toBeCloseTo(236);

    const summaryRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["סיכום"], { header: 1 });
    expect(summaryRows.find(row => row[0] === "מע״מ לתשלום")?.[1]).toBeCloseTo(12.06);
    expect(summaryRows.find(row => row[0] === "שם התקופה")?.[1]).toBe("מרץ–אפריל 2026");
  });
});
