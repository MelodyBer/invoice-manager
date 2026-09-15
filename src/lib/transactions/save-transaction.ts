import { saveFinancialTransaction } from "./financial-actions";
import type { createClient } from "@/lib/supabase/client";
import type { TransactionFormValues } from "@/types/transaction-form";
export interface SaveTransactionResult { errorMessage: string | null; }
export async function insertTransaction(_supabase:ReturnType<typeof createClient>,_userId:string,documentId:string|null,values:TransactionFormValues):Promise<SaveTransactionResult>{
 return saveFinancialTransaction(documentId,values);
}
