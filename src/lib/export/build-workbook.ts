import "server-only";
import * as XLSX from "xlsx";
import { addCents, fromCents, percentOfCents, toCents } from "@/lib/calc";
import { formatDateDDMMYYYY } from "@/lib/format";
import { DOC_TYPE_OPTIONS } from "@/types/transaction-form";
import type { ExportData } from "./load-export-data";

const CURRENCY_FORMAT = '#,##0.00" ₪"';
const BOLD = { font: { bold: true } };

function docTypeLabel(docType: string): string {
  return DOC_TYPE_OPTIONS.find(option => option.value === docType)?.label ?? docType;
}

function recognizedVat(vatAmount: number, deductiblePercent: number): number {
  return fromCents(percentOfCents(toCents(vatAmount), deductiblePercent));
}

/** Sums a shekel column with integer-agorot precision, matching the rest of the app's money handling. */
function sumColumn(values: readonly number[]): number {
  return fromCents(values.reduce((cents, value) => addCents(cents, toCents(value)), 0));
}

function autoWidth(header: readonly string[]): { wch: number }[] {
  return header.map(label => ({ wch: Math.max(10, label.length + 4) }));
}

function applyCurrencyFormat(sheet: XLSX.WorkSheet, rowStart: number, rowEndInclusive: number, columns: readonly number[]): void {
  for (let row = rowStart; row <= rowEndInclusive; row++) {
    for (const column of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === "n") cell.z = CURRENCY_FORMAT;
    }
  }
}

function applyBoldRow(sheet: XLSX.WorkSheet, row: number, columnCount: number): void {
  for (let column = 0; column < columnCount; column++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell) cell.s = BOLD;
  }
}

const EXPENSE_HEADER = ["תאריך", "שם ספק", "מספר עוסק", "מספר מסמך", "סוג מסמך", "קטגוריה", "סכום לפני מע״מ", "מע״מ", "אחוז הכרה", "מע״מ מוכר", "סה״כ", "הערות"] as const;
const EXPENSE_MONEY_COLUMNS = [6, 7, 9, 10] as const;

function buildExpenseSheet(data: ExportData): XLSX.WorkSheet {
  const rows = data.rows.filter(row => row.direction === "expense");
  const recognized = rows.map(row => recognizedVat(row.vat_amount, row.vat_deductible_percent));
  const body = rows.map((row, index) => [
    formatDateDDMMYYYY(row.doc_date), row.counterparty_name, data.businessNumbers[row.id] ?? "", row.doc_number ?? "",
    docTypeLabel(row.doc_type), data.categoryNames[row.category_id ?? ""] ?? "ללא קטגוריה",
    row.amount_before_vat, row.vat_amount, `${row.vat_deductible_percent}%`, recognized[index],
    row.amount_total, row.notes ?? "",
  ]);
  const summaryRow = ["", "", "", "", "", "סה״כ", sumColumn(rows.map(row => row.amount_before_vat)), sumColumn(rows.map(row => row.vat_amount)), "", sumColumn(recognized), sumColumn(rows.map(row => row.amount_total)), ""];
  const sheet = XLSX.utils.aoa_to_sheet([[...EXPENSE_HEADER], ...body, [], summaryRow]);
  sheet["!cols"] = autoWidth(EXPENSE_HEADER);
  applyCurrencyFormat(sheet, 1, body.length, EXPENSE_MONEY_COLUMNS);
  const summaryRowIndex = body.length + 2;
  applyCurrencyFormat(sheet, summaryRowIndex, summaryRowIndex, EXPENSE_MONEY_COLUMNS);
  applyBoldRow(sheet, 0, EXPENSE_HEADER.length);
  applyBoldRow(sheet, summaryRowIndex, EXPENSE_HEADER.length);
  return sheet;
}

const INCOME_HEADER = ["תאריך", "שם לקוח", "מספר מסמך", "סוג מסמך", "קטגוריה", "סכום לפני מע״מ", "מע״מ", "סה״כ", "הערות"] as const;
const INCOME_MONEY_COLUMNS = [5, 6, 7] as const;

function buildIncomeSheet(data: ExportData): XLSX.WorkSheet {
  const rows = data.rows.filter(row => row.direction === "income");
  const body = rows.map(row => [
    formatDateDDMMYYYY(row.doc_date), row.counterparty_name, row.doc_number ?? "", docTypeLabel(row.doc_type),
    data.categoryNames[row.category_id ?? ""] ?? "ללא קטגוריה", row.amount_before_vat, row.vat_amount, row.amount_total, row.notes ?? "",
  ]);
  const summaryRow = ["", "", "", "", "סה״כ", sumColumn(rows.map(row => row.amount_before_vat)), sumColumn(rows.map(row => row.vat_amount)), sumColumn(rows.map(row => row.amount_total)), ""];
  const sheet = XLSX.utils.aoa_to_sheet([[...INCOME_HEADER], ...body, [], summaryRow]);
  sheet["!cols"] = autoWidth(INCOME_HEADER);
  applyCurrencyFormat(sheet, 1, body.length, INCOME_MONEY_COLUMNS);
  const summaryRowIndex = body.length + 2;
  applyCurrencyFormat(sheet, summaryRowIndex, summaryRowIndex, INCOME_MONEY_COLUMNS);
  applyBoldRow(sheet, 0, INCOME_HEADER.length);
  applyBoldRow(sheet, summaryRowIndex, INCOME_HEADER.length);
  return sheet;
}

function buildSummarySheet(data: ExportData): XLSX.WorkSheet {
  const { summary, profile, range } = data;
  const aoa: (string | number)[][] = [
    ["שם העסק", profile.business_name ?? "לא הוגדר"],
    ["מספר עוסק", profile.business_number ?? "לא הוגדר"],
    ["שם התקופה", range.label],
    [],
    ["מע״מ עסקאות", fromCents(summary.outputVat)],
    ["מע״מ תשומות", fromCents(summary.inputVat)],
    ["מע״מ לתשלום", fromCents(summary.vatDue)],
    ["מחזור", fromCents(summary.incomeBeforeVat)],
    ["סך הוצאות מוכרות", fromCents(summary.expenseBeforeVat)],
    ["רווח לפני מס", fromCents(summary.profitBeforeTax)],
    ["מקדמות מס הכנסה", fromCents(summary.taxAdvance)],
    ["כרית מס להפרשה", fromCents(summary.taxReserve)],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 22 }, { wch: 24 }];
  applyCurrencyFormat(sheet, 4, 11, [1]);
  for (let row = 0; row <= 2; row++) applyBoldRow(sheet, row, 1);
  return sheet;
}

export function buildExportWorkbook(data: ExportData): Buffer {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, buildExpenseSheet(data), "הוצאות");
  XLSX.utils.book_append_sheet(workbook, buildIncomeSheet(data), "הכנסות");
  XLSX.utils.book_append_sheet(workbook, buildSummarySheet(data), "סיכום");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }) as Buffer;
}
