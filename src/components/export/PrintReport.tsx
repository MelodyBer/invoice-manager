import { fromCents, percentOfCents, toCents } from "@/lib/calc";
import { formatCurrencyILS, formatDateDDMMYYYY } from "@/lib/format";
import { DOC_TYPE_OPTIONS } from "@/types/transaction-form";
import type { ExportData } from "@/lib/export/load-export-data";

function docTypeLabel(docType: string): string {
  return DOC_TYPE_OPTIONS.find(option => option.value === docType)?.label ?? docType;
}

function recognizedVat(vatAmount: number, deductiblePercent: number): number {
  return fromCents(percentOfCents(toCents(vatAmount), deductiblePercent));
}

const SUMMARY_ROWS: readonly [label: string, key: "outputVat" | "inputVat" | "vatDue" | "incomeBeforeVat" | "expenseBeforeVat" | "profitBeforeTax" | "taxAdvance" | "taxReserve"][] = [
  ["מע״מ עסקאות", "outputVat"],
  ["מע״מ תשומות", "inputVat"],
  ["מע״מ לתשלום", "vatDue"],
  ["מחזור", "incomeBeforeVat"],
  ["סך הוצאות מוכרות", "expenseBeforeVat"],
  ["רווח לפני מס", "profitBeforeTax"],
  ["מקדמות מס הכנסה", "taxAdvance"],
  ["כרית מס להפרשה", "taxReserve"],
];

export function PrintReport({ data, generatedAt }: { data: ExportData; generatedAt: string }): React.JSX.Element {
  const incomeRows = data.rows.filter(row => row.direction === "income");
  const expenseRows = data.rows.filter(row => row.direction === "expense");

  return (
    <div className="report">
      <header className="report-header">
        <h1>{data.profile.business_name ?? "העסק שלי"}</h1>
        {data.profile.business_number && <p>מספר עוסק מורשה: {data.profile.business_number}</p>}
        <p className="report-period">תקופה: {data.range.label} ({formatDateDDMMYYYY(data.range.start)} – {formatDateDDMMYYYY(data.range.end)})</p>
      </header>

      <section>
        <h2>סיכום מע״מ ורווח</h2>
        <table>
          <tbody>
            {SUMMARY_ROWS.map(([label, key]) => (
              <tr key={key}><th>{label}</th><td>{formatCurrencyILS(fromCents(data.summary[key]))}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>הכנסות ({incomeRows.length})</h2>
        {incomeRows.length === 0 ? <p>אין הכנסות בטווח שנבחר.</p> : (
          <table>
            <thead><tr><th>תאריך</th><th>שם לקוח</th><th>מספר מסמך</th><th>סוג מסמך</th><th>קטגוריה</th><th>לפני מע״מ</th><th>מע״מ</th><th>סה״כ</th></tr></thead>
            <tbody>
              {incomeRows.map(row => (
                <tr key={row.id}>
                  <td>{formatDateDDMMYYYY(row.doc_date)}</td><td>{row.counterparty_name}</td><td>{row.doc_number ?? "—"}</td>
                  <td>{docTypeLabel(row.doc_type)}</td><td>{data.categoryNames[row.category_id ?? ""] ?? "ללא קטגוריה"}</td>
                  <td>{formatCurrencyILS(row.amount_before_vat)}</td><td>{formatCurrencyILS(row.vat_amount)}</td><td>{formatCurrencyILS(row.amount_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>סה״כ</th>
                <th>{formatCurrencyILS(fromCents(data.summary.incomeBeforeVat))}</th>
                <th>{formatCurrencyILS(fromCents(data.summary.outputVat))}</th>
                <th>{formatCurrencyILS(fromCents(data.summary.incomeTotal))}</th>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section>
        <h2>הוצאות ({expenseRows.length})</h2>
        {expenseRows.length === 0 ? <p>אין הוצאות בטווח שנבחר.</p> : (
          <table>
            <thead><tr><th>תאריך</th><th>שם ספק</th><th>מספר עוסק</th><th>מספר מסמך</th><th>סוג מסמך</th><th>קטגוריה</th><th>לפני מע״מ</th><th>מע״מ</th><th>אחוז הכרה</th><th>מע״מ מוכר</th><th>סה״כ</th></tr></thead>
            <tbody>
              {expenseRows.map(row => (
                <tr key={row.id}>
                  <td>{formatDateDDMMYYYY(row.doc_date)}</td><td>{row.counterparty_name}</td><td>{data.businessNumbers[row.id] ?? "—"}</td><td>{row.doc_number ?? "—"}</td>
                  <td>{docTypeLabel(row.doc_type)}</td><td>{data.categoryNames[row.category_id ?? ""] ?? "ללא קטגוריה"}</td>
                  <td>{formatCurrencyILS(row.amount_before_vat)}</td><td>{formatCurrencyILS(row.vat_amount)}</td>
                  <td>{row.vat_deductible_percent}%</td><td>{formatCurrencyILS(recognizedVat(row.vat_amount, row.vat_deductible_percent))}</td>
                  <td>{formatCurrencyILS(row.amount_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={6}>סה״כ</th>
                <th>{formatCurrencyILS(fromCents(data.summary.expenseBeforeVat))}</th>
                <th colSpan={2}>{formatCurrencyILS(fromCents(data.summary.inputVat))}</th>
                <th />
                <th>{formatCurrencyILS(fromCents(data.summary.expenseTotal))}</th>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <footer className="report-footer">הופק בתאריך {formatDateDDMMYYYY(generatedAt)}</footer>
    </div>
  );
}
