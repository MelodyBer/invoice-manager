"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "./load-range";
import { prepareFinancialValues, documentFinancialValues } from "./financial-server";
import type { TransactionFormValues } from "@/types/transaction-form";
export async function saveFinancialTransaction(documentId:string|null,values:TransactionFormValues):Promise<{errorMessage:string|null}>{
 const {supabase}=await userContext();
 try{
  const prepared=await prepareFinancialValues(values);
  const {error}=await supabase.rpc("save_financial_record",{p_values:{...prepared,document_id:documentId},p_document_values:documentId?{[documentId]:documentFinancialValues(values,prepared)}:{}});
  if(error)return {errorMessage:"השמירה לא הושלמה. ייתכן שהמסמך כבר אושר או השתנה. רענני ונסי שוב."};
  revalidatePath("/documents");revalidatePath("/transactions");revalidatePath("/calendar");
  return {errorMessage:null};
 }catch(error){return {errorMessage:error instanceof Error?error.message:"שמירת הסכומים נכשלה."};}
}
