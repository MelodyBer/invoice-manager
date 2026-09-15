import "server-only";
import { getBoiRate } from "@/lib/currency/boi";
import { convertMoney } from "@/lib/currency/money";
import { validateTransactionValues } from "./validate-values";
import { transactionPayload } from "./transaction-payload";
import type { TransactionFormValues } from "@/types/transaction-form";
export async function prepareFinancialValues(values:TransactionFormValues):Promise<Record<string,unknown>>{
 const error=validateTransactionValues(values);if(error)throw new Error(error);
 if(values.currency!=="ILS"&&values.currency!=="USD")throw new Error("בחרי שקל או דולר אמריקאי.");
 const rate=await getBoiRate(values.docDate);
 return {...transactionPayload(values),...convertMoney(values.currency,Number(values.amountBeforeVat),Number(values.vatAmount),Number(values.amountTotal),rate),currency_review_required:false};
}
export function documentFinancialValues(values:TransactionFormValues,prepared:Record<string,unknown>):Record<string,unknown>{
 return {...prepared,valuation_date:values.docDate,verified_doc_type:values.docType,verified_counterparty_name:values.counterpartyName,direction:values.direction};
}
