import type { Direction, DocType, ProfileRow } from "@/types/db";
import type { ExtractionConfidence } from "@/types/extraction";
import type { TransactionFormValues } from "@/types/transaction-form";

const DOC_TYPES: readonly DocType[] = [
  "invoice_tax",
  "invoice_tax_receipt",
  "receipt",
  "invoice_offer",
  "other",
];

function getStringField(raw: Record<string, unknown> | null, key: string): string {
  if (!raw) {
    return "";
  }
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

function getNumberField(raw: Record<string, unknown> | null, key: string): number | null {
  if (!raw) {
    return null;
  }
  const value = raw[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDocTypeField(raw: Record<string, unknown> | null): DocType {
  const value = raw ? raw.doc_type : null;
  return typeof value === "string" && (DOC_TYPES as readonly string[]).includes(value)
    ? (value as DocType)
    : "other";
}

export function getExtractionConfidence(
  raw: Record<string, unknown> | null
): ExtractionConfidence | null {
  if (!raw) {
    return null;
  }
  const value = raw.confidence;
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const fields: (keyof ExtractionConfidence)[] = [
    "counterparty_name",
    "doc_number",
    "doc_date",
    "amount_total",
    "doc_type",
  ];
  const result = {} as ExtractionConfidence;
  for (const field of fields) {
    const fieldValue = record[field];
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      return null;
    }
    result[field] = fieldValue;
  }
  return result;
}

export function buildInitialValuesFromExtraction(
  direction: Direction,
  extractionRaw: Record<string, unknown> | null,
  profile: ProfileRow | null
): TransactionFormValues {
  const amountBeforeVat = getNumberField(extractionRaw, "amount_before_vat");
  const vatAmount = getNumberField(extractionRaw, "vat_amount");
  const amountTotal = getNumberField(extractionRaw, "amount_total");
  const vatRate = getNumberField(extractionRaw, "vat_rate");

  return {
    currency: getStringField(extractionRaw, "currency").toUpperCase() || "ILS",
    direction,
    counterpartyName: getStringField(extractionRaw, "counterparty_name"),
    docNumber: getStringField(extractionRaw, "doc_number"),
    docType: getDocTypeField(extractionRaw),
    docDate: getStringField(extractionRaw, "doc_date"),
    amountBeforeVat: amountBeforeVat !== null ? String(amountBeforeVat) : "",
    vatAmount: vatAmount !== null ? String(vatAmount) : "",
    amountTotal: amountTotal !== null ? String(amountTotal) : "",
    vatRate: vatRate !== null ? String(vatRate) : profile ? String(profile.vat_rate) : "18",
    vatDeductiblePercent: vatRate === 0 ? 0 : 100,
    categoryId: null,
    notes: getStringField(extractionRaw, "notes"),
  };
}

export function buildEmptyManualValues(profile: ProfileRow | null): TransactionFormValues {
  return {
    currency: "ILS",
    direction: "expense",
    counterpartyName: "",
    docNumber: "",
    docType: "other",
    docDate: "",
    amountBeforeVat: "",
    vatAmount: "",
    amountTotal: "",
    vatRate: profile ? String(profile.vat_rate) : "18",
    vatDeductiblePercent: 100,
    categoryId: null,
    notes: "",
  };
}
