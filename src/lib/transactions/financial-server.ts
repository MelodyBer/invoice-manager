import "server-only";
import { getBoiRate } from "@/lib/currency/boi";
import { convertMoney, shekelMoney } from "@/lib/currency/money";
import { validateTransactionValues } from "./validate-values";
import { todayIsrael } from "./reporting";
import { transactionPayload } from "./transaction-payload";
import type { TransactionFormValues } from "@/types/transaction-form";
export async function prepareFinancialValues(values:TransactionFormValues):Promise<Record<string,unknown>>{
 const error=validateTransactionValues(values);if(error)throw new Error(error);
 if(values.currency!=="ILS"&&values.currency!=="USD")throw new Error("בחרי שקל או דולר אמריקאי.");
 if(values.docDate<"2020-01-01"||values.docDate>todayIsrael())throw new Error("יש לבחור תאריך תקין מ־2020 ועד היום.");
 const before=Number(values.amountBeforeVat),vat=Number(values.vatAmount),total=Number(values.amountTotal);
 const money=values.currency==="ILS"
  ? shekelMoney(before,vat,total)
  : convertMoney("USD",before,vat,total,await getBoiRate(values.docDate));
 return {...transactionPayload(values),...money,currency_review_required:false};
}
export function documentFinancialValues(values:TransactionFormValues,prepared:Record<string,unknown>):Record<string,unknown>{
 return {...prepared,valuation_date:values.docDate,verified_doc_type:values.docType,verified_counterparty_name:values.counterpartyName,direction:values.direction};
}
