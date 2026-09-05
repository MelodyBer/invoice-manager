export type Direction = "expense" | "income";

export type ReportingFrequency = "bimonthly" | "monthly";

export type DocumentStatus = "pending" | "processing" | "processed" | "failed";

export type DocType =
  | "invoice_tax"
  | "invoice_tax_receipt"
  | "receipt"
  | "invoice_offer"
  | "other";

export type PeriodStatus = "open" | "closed";

export type ProfileRow = {
  id: string;
  business_name: string | null;
  business_number: string | null;
  vat_rate: number;
  reporting_frequency: ReportingFrequency;
  income_tax_advance_rate: number;
  tax_reserve_rate: number;
  created_at: string;
};

export type ProfileInsert = {
  id: string;
  business_name?: string | null;
  business_number?: string | null;
  vat_rate?: number;
  reporting_frequency?: ReportingFrequency;
  income_tax_advance_rate?: number;
  tax_reserve_rate?: number;
};

export type ProfileUpdate = Partial<Omit<ProfileRow, "id" | "created_at">>;

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  direction: Direction;
  default_vat_deductible_percent: number;
  is_system: boolean;
  created_at: string;
};

export type CategoryInsert = {
  id?: string;
  user_id: string;
  name: string;
  direction: Direction;
  default_vat_deductible_percent?: number;
  is_system?: boolean;
};

export type CategoryUpdate = Partial<Omit<CategoryRow, "id" | "user_id" | "created_at">>;

export type DocumentRow = {
  id: string;
  user_id: string;
  direction: Direction;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  extraction_raw: Record<string, unknown> | null;
  error_message: string | null;
  uploaded_at: string;
};

export type DocumentInsert = {
  id?: string;
  user_id: string;
  direction: Direction;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status?: DocumentStatus;
  extraction_raw?: Record<string, unknown> | null;
  error_message?: string | null;
};

export type DocumentUpdate = Partial<Omit<DocumentRow, "id" | "user_id" | "uploaded_at">>;

export type TransactionRow = {
  id: string;
  user_id: string;
  document_id: string | null;
  direction: Direction;
  counterparty_name: string;
  doc_number: string | null;
  doc_type: DocType;
  doc_date: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_total: number;
  vat_rate: number;
  vat_deductible_percent: number;
  category_id: string | null;
  currency: string;
  notes: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type TransactionInsert = {
  id?: string;
  user_id: string;
  document_id?: string | null;
  direction: Direction;
  counterparty_name: string;
  doc_number?: string | null;
  doc_type: DocType;
  doc_date: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_total: number;
  vat_rate?: number;
  vat_deductible_percent?: number;
  category_id?: string | null;
  currency?: string;
  notes?: string | null;
  is_verified?: boolean;
};

export type TransactionUpdate = Partial<
  Omit<TransactionRow, "id" | "user_id" | "created_at" | "updated_at">
>;

export type PeriodRow = {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status: PeriodStatus;
  submitted_at: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
};

export type PeriodInsert = {
  id?: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status?: PeriodStatus;
  submitted_at?: string | null;
  snapshot?: Record<string, unknown> | null;
};

export type PeriodUpdate = Partial<Omit<PeriodRow, "id" | "user_id" | "created_at">>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: TransactionInsert;
        Update: TransactionUpdate;
        Relationships: [];
      };
      periods: {
        Row: PeriodRow;
        Insert: PeriodInsert;
        Update: PeriodUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
