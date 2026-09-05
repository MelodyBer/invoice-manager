import type { DocType } from "@/types/db";
import type { ExtractionConfidence, ExtractionResult } from "@/types/extraction";

const DOC_TYPES: readonly DocType[] = [
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
  "invoice_offer",
  "other",
];

function isDocType(value: unknown): value is DocType {
  return typeof value === "string" && (DOC_TYPES as readonly string[]).includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const CONFIDENCE_FIELDS: readonly (keyof ExtractionConfidence)[] = [
  "counterparty_name",
  "doc_number",
  "doc_date",
  "amount_total",
  "doc_type",
];

function parseConfidence(value: unknown): ExtractionConfidence | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const result = {} as Record<keyof ExtractionConfidence, number>;

  for (const field of CONFIDENCE_FIELDS) {
    const fieldValue = record[field];
    if (!isFiniteNumber(fieldValue)) {
      return null;
    }
    result[field] = Math.min(1, Math.max(0, fieldValue));
  }

  return result;
}

export function parseExtractionResult(input: unknown): ExtractionResult | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const record = input as Record<string, unknown>;

  const counterpartyName = record.counterparty_name;
  const businessNumber = record.business_number;
  const docNumber = record.doc_number;
  const docType = record.doc_type;
  const docDate = record.doc_date;
  const currency = record.currency;
  const amountBeforeVat = record.amount_before_vat;
  const vatAmount = record.vat_amount;
  const amountTotal = record.amount_total;
  const vatRate = record.vat_rate;
  const notes = record.notes;

  if (typeof counterpartyName !== "string") return null;
  if (!isNullableString(businessNumber)) return null;
  if (!isNullableString(docNumber)) return null;
  if (!isDocType(docType)) return null;
  if (typeof docDate !== "string") return null;
  if (typeof currency !== "string") return null;
  if (!isFiniteNumber(amountBeforeVat)) return null;
  if (!isFiniteNumber(vatAmount)) return null;
  if (!isFiniteNumber(amountTotal)) return null;
  if (!isFiniteNumber(vatRate)) return null;
  if (!isNullableString(notes)) return null;

  const confidence = parseConfidence(record.confidence);
  if (!confidence) return null;

  return {
    counterparty_name: counterpartyName,
    business_number: businessNumber,
    doc_number: docNumber,
    doc_type: docType,
    doc_date: docDate,
    currency,
    amount_before_vat: amountBeforeVat,
    vat_amount: vatAmount,
    amount_total: amountTotal,
    vat_rate: vatRate,
    confidence,
    notes,
  };
}
