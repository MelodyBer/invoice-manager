import type { TransactionFormValues } from "@/types/transaction-form";
export function transactionPayload(values: TransactionFormValues): Record<string, unknown> {
 return {direction:values.direction,counterparty_name:values.counterpartyName.trim(),doc_number:values.docNumber.trim()||null,doc_type:values.docType,doc_date:values.docDate,amount_before_vat:Number(values.amountBeforeVat),vat_amount:Number(values.vatAmount),amount_total:Number(values.amountTotal),vat_rate:Number(values.vatRate),vat_deductible_percent:values.direction==="expense"?values.vatDeductiblePercent:100,category_id:values.categoryId,notes:values.notes||null};
}
