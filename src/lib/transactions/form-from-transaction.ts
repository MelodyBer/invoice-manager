import type { TransactionRow } from "@/types/db";
import type { TransactionFormValues } from "@/types/transaction-form";
export function formFromTransaction(t:TransactionRow):TransactionFormValues {
 return {currency:t.currency,direction:t.direction,counterpartyName:t.counterparty_name,docNumber:t.doc_number??"",docType:t.doc_type,docDate:t.doc_date,
 amountBeforeVat:String(t.original_amount_before_vat??t.amount_before_vat),vatAmount:String(t.original_vat_amount??t.vat_amount),amountTotal:String(t.original_amount_total??t.amount_total),
 vatRate:String(t.vat_rate),vatDeductiblePercent:t.vat_deductible_percent,categoryId:t.category_id,notes:t.notes??""};
}
