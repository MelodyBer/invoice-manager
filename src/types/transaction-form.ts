import type { Direction, DocType } from "@/types/db";

export interface TransactionFormValues {
  direction: Direction;
  counterpartyName: string;
  docNumber: string;
  docType: DocType;
  docDate: string;
  amountBeforeVat: string;
  vatAmount: string;
  amountTotal: string;
  vatRate: string;
  vatDeductiblePercent: number;
  categoryId: string | null;
  notes: string;
}

export const DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "invoice_tax", label: "חשבונית מס" },
  { value: "invoice_tax_receipt", label: "חשבונית מס-קבלה" },
  { value: "receipt", label: "קבלה" },
  { value: "invoice_offer", label: "חשבונית עסקה" },
  { value: "other", label: "אחר" },
];

export const VAT_DEDUCTIBLE_OPTIONS: { value: string; label: string }[] = [
  { value: "100", label: "100%" },
  { value: "66", label: "66%" },
  { value: "25", label: "25%" },
  { value: "0", label: "0%" },
];
