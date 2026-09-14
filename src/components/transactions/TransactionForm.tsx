import { Card, Input, Select, HebrewDatePicker } from "@/components/ui";
import { DirectionToggle } from "@/components/upload/DirectionToggle";
import { DOC_TYPE_OPTIONS, VAT_DEDUCTIBLE_OPTIONS } from "@/types/transaction-form";
import type { TransactionFormValues } from "@/types/transaction-form";
import type { CategoryRow, Direction, DocType } from "@/types/db";
import type { ExtractionConfidence } from "@/types/extraction";

interface TransactionFormProps {
  values: TransactionFormValues;
  isVatManuallyEdited?: boolean;
  onFieldChange: (patch: Partial<TransactionFormValues>) => void;
  categories: CategoryRow[];
  confidence: ExtractionConfidence | null;
}

const TAX_DEDUCTIBLE_DOC_TYPES: readonly DocType[] = ["invoice_tax", "invoice_tax_receipt"];
const LOW_CONFIDENCE_THRESHOLD = 0.8;
const LOW_CONFIDENCE_HINT = "כדאי לבדוק";

function isLowConfidence(
  confidence: ExtractionConfidence | null,
  field: keyof ExtractionConfidence
): boolean {
  if (!confidence) {
    return false;
  }
  return confidence[field] < LOW_CONFIDENCE_THRESHOLD;
}

export function TransactionForm({
  values,
  isVatManuallyEdited = false,
  onFieldChange,
  categories,
  confidence,
}: TransactionFormProps): React.JSX.Element {
  const categoryOptions = categories
    .filter((category) => category.direction === values.direction)
    .map((category) => ({ value: category.id, label: category.name }));

  const withoutVat = values.vatRate.trim() !== "" && Number(values.vatRate) === 0;
  const showVatDeductibleField = values.direction === "expense" && !withoutVat;
  const showVatWarning =
    showVatDeductibleField &&
    !TAX_DEDUCTIBLE_DOC_TYPES.includes(values.docType) &&
    values.vatDeductiblePercent > 0;

  function handleDirectionChange(direction: Direction): void {
    onFieldChange({ direction, categoryId: null });
  }

  function handleCategoryChange(categoryId: string): void {
    const category = categories.find((current) => current.id === categoryId);
    onFieldChange({
      categoryId: categoryId || null,
      ...(category && showVatDeductibleField
        ? { vatDeductiblePercent: category.default_vat_deductible_percent }
        : {}),
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">סוג תנועה</span>
        <DirectionToggle value={values.direction} onChange={handleDirectionChange} />
      </div>

      <h2 className="border-b border-border pb-2 font-semibold">פרטי המסמך</h2>
      <Input
        id="counterparty-name"
        label={values.direction === "expense" ? "שם הספק" : "שם הלקוח"}
        value={values.counterpartyName}
        onChange={(event) => onFieldChange({ counterpartyName: event.target.value })}
        warning={
          isLowConfidence(confidence, "counterparty_name") ? LOW_CONFIDENCE_HINT : undefined
        }
      />

      <Input
        id="doc-number"
        label="מספר מסמך"
        value={values.docNumber}
        onChange={(event) => onFieldChange({ docNumber: event.target.value })}
        warning={isLowConfidence(confidence, "doc_number") ? LOW_CONFIDENCE_HINT : undefined}
      />

      <Select
        id="doc-type"
        label="סוג מסמך"
        options={DOC_TYPE_OPTIONS}
        value={values.docType}
        onChange={(event) => onFieldChange({ docType: event.target.value as DocType })}
        warning={isLowConfidence(confidence, "doc_type") ? LOW_CONFIDENCE_HINT : undefined}
      />

      <HebrewDatePicker
        id="doc-date"
        label="תאריך המסמך"
        value={values.docDate}
        onChange={(value) => onFieldChange({ docDate: value })}
        warning={isLowConfidence(confidence, "doc_date") ? LOW_CONFIDENCE_HINT : undefined}
      />

      <h2 className="mt-2 border-b border-border pb-2 font-semibold">סכומים ומע״מ</h2>
      <label className="flex items-center gap-2 rounded-lg border border-border p-3">
        <input type="checkbox" checked={withoutVat} onChange={(event) => onFieldChange({ vatRate: event.target.checked ? "0" : "18" })} />
        <span>ללא מע״מ (למשל, מסמך מעוסק פטור)</span>
      </label>
      {withoutVat && <p className="text-sm text-foreground/70">כל הסכום נרשם ללא מע״מ. אין מע״מ תשומות לקיזוז.</p>}

      <Input
        id="amount-before-vat"
        label="סכום לפני מע״מ"
        type="number"
        step="0.01"
        inputMode="decimal"
        value={values.amountBeforeVat}
        onChange={(event) => onFieldChange({ amountBeforeVat: event.target.value })}
      />

      <Input
        id="vat-amount"
        disabled={withoutVat}
        label={isVatManuallyEdited ? "סכום מע״מ — נערך ידנית" : "סכום מע״מ"}
        type="number"
        step="0.01"
        inputMode="decimal"
        value={values.vatAmount}
        onChange={(event) => onFieldChange({ vatAmount: event.target.value })}
      />

      <Input
        id="amount-total"
        label="סכום כולל"
        type="number"
        step="0.01"
        inputMode="decimal"
        value={values.amountTotal}
        onChange={(event) => onFieldChange({ amountTotal: event.target.value })}
        warning={isLowConfidence(confidence, "amount_total") ? LOW_CONFIDENCE_HINT : undefined}
      />

      <Input
        id="vat-rate"
        label="שיעור מע״מ (%)"
        type="number"
        step="0.01"
        inputMode="decimal"
        value={values.vatRate}
        onChange={(event) => onFieldChange({ vatRate: event.target.value })}
      />

      {showVatDeductibleField ? (
        <Select
          id="vat-deductible-percent"
          label="אחוז הכרה במע״מ תשומות"
          options={VAT_DEDUCTIBLE_OPTIONS}
          value={String(values.vatDeductiblePercent)}
          onChange={(event) => onFieldChange({ vatDeductiblePercent: Number(event.target.value) })}
        />
      ) : null}

      {showVatWarning ? (
        <p className="rounded-lg border border-warning bg-warning/10 p-3 text-sm text-warning">
          מסמך מסוג זה אינו מזכה בקיזוז מע״מ תשומות
        </p>
      ) : null}

      <h2 className="mt-2 border-b border-border pb-2 font-semibold">סיווג והערות</h2>
      <Select
        id="category"
        label="קטגוריה"
        options={[{ value: "", label: "בחרי קטגוריה" }, ...categoryOptions]}
        value={values.categoryId ?? ""}
        onChange={(event) => handleCategoryChange(event.target.value)}
      />

      <Input
        id="notes"
        label="הערות"
        value={values.notes}
        onChange={(event) => onFieldChange({ notes: event.target.value })}
      />
    </Card>
  );
}
