import type { TransactionFormValues } from "@/types/transaction-form";

export function validateTransactionValues(values: TransactionFormValues): string | null {
  if (!values || typeof values !== "object" || [values.currency,values.counterpartyName,values.docNumber,values.docDate,values.amountBeforeVat,values.vatAmount,values.amountTotal,values.vatRate,values.notes].some(value=>typeof value!=="string")) return "נתוני הטופס אינם תקינים.";
  if (!["ILS", "USD"].includes(values.currency)) return "יש לבחור מטבע: שקל או דולר אמריקאי.";
  if (!values.counterpartyName.trim()) return "יש למלא שם ספק או לקוח.";
  const date = new Date(`${values.docDate}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.docDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.docDate) return "יש לבחור תאריך תקין.";
  const amounts = [values.amountBeforeVat, values.vatAmount, values.amountTotal];
  if (amounts.some(value => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) >= 1e10 || Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) > 0.0001)) return "יש להזין סכומים תקינים, עד שתי ספרות אחרי הנקודה.";
  if (Number(values.amountTotal) <= 0) return "הסכום הכולל חייב להיות גדול מאפס.";
  if (Math.abs(Math.round(Number(values.amountBeforeVat) * 100) + Math.round(Number(values.vatAmount) * 100) - Math.round(Number(values.amountTotal) * 100)) > 1) return "הסכומים אינם תואמים. בדקי את הסכום הכולל והמע״מ.";
  if (!values.vatRate.trim() || !Number.isFinite(Number(values.vatRate)) || Number(values.vatRate) < 0 || Number(values.vatRate) > 100) return "שיעור המע״מ חייב להיות בין 0 ל־100.";
  if (![0, 25, 66, 100].includes(values.vatDeductiblePercent)) return "יש לבחור אחוז הכרה תקין.";
  return null;
}
