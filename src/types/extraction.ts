import type { DocType } from "@/types/db";

export type ExtractionConfidence = {
  counterparty_name: number;
  doc_number: number;
  doc_date: number;
  amount_total: number;
  doc_type: number;
};

export type ExtractionResult = {
  counterparty_name: string;
  business_number: string | null;
  doc_number: string | null;
  doc_type: DocType;
  doc_date: string;
  currency: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_total: number;
  vat_rate: number;
  confidence: ExtractionConfidence;
  notes: string | null;
};

export type ValidatedExtractionResult = Omit<ExtractionResult, "doc_date"> & {
  doc_date: string | null;
};
