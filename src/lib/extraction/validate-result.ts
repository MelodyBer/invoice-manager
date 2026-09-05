import type { ExtractionResult, ValidatedExtractionResult } from "@/types/extraction";

const AGORA_TOLERANCE = 0.01;
const MIN_YEAR = 2020;
const DEFAULT_VAT_RATE = 18;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function applyBusinessValidation(result: ExtractionResult): ValidatedExtractionResult {
  const notesToAppend: string[] = [];

  let amountBeforeVat = result.amount_before_vat;
  let vatAmount = result.vat_amount;
  const amountTotal = result.amount_total;

  const computedTotal = amountBeforeVat + vatAmount;
  if (Math.abs(computedTotal - amountTotal) > AGORA_TOLERANCE) {
    const vatRate = result.vat_rate > 0 ? result.vat_rate : DEFAULT_VAT_RATE;
    amountBeforeVat = round2(amountTotal / (1 + vatRate / 100));
    vatAmount = round2(amountTotal - amountBeforeVat);
    notesToAppend.push("הסכומים לא התאזנו — חושבו מחדש מתוך הסכום הכולל.");
  }

  let docDate: string | null = result.doc_date;
  const parsedDate = new Date(`${result.doc_date}T00:00:00Z`);
  const today = new Date();
  const minDate = new Date(`${MIN_YEAR}-01-01T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime()) || parsedDate > today || parsedDate < minDate) {
    docDate = null;
    notesToAppend.push("תאריך המסמך חריג (עתידי או לפני 2020) — יש לבדוק ולהזין ידנית.");
  }

  if (amountBeforeVat < 0 || vatAmount < 0 || amountTotal < 0) {
    notesToAppend.push("נמצאו סכומים שליליים — יש לבדוק את המסמך.");
  }

  const combinedNotes = [result.notes, ...notesToAppend]
    .filter((note): note is string => Boolean(note))
    .join(" ");

  return {
    ...result,
    amount_before_vat: amountBeforeVat,
    vat_amount: vatAmount,
    doc_date: docDate,
    notes: combinedNotes.length > 0 ? combinedNotes : null,
  };
}
