"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "./load-range";
import { prepareFinancialValues, documentFinancialValues } from "./financial-server";
import type { TransactionFormValues } from "@/types/transaction-form";
export async function saveFinancialTransaction(documentId:string|null,values:TransactionFormValues):Promise<{errorMessage:string|null}>{
 const startedAt=performance.now();
 const timings:Record<string,number>={};
 async function measure<T>(stage:string,operation:()=>Promise<T>):Promise<T>{
  const start=performance.now();
  try{return await operation();}finally{timings[stage]=Math.round(performance.now()-start);}
 }
 try {
 const {supabase}=await measure("auth",()=>userContext());
 try{
  const prepared=await measure("prepare",()=>prepareFinancialValues(values));
  const {error}=await measure("rpc",async()=>await supabase.rpc("save_financial_record",{p_values:{...prepared,document_id:documentId},p_document_values:documentId?{[documentId]:documentFinancialValues(values,prepared)}:{}}));
  if(error)return {errorMessage:"השמירה לא הושלמה. ייתכן שהמסמך כבר אושר או השתנה. רענני ונסי שוב."};
  await measure("revalidate",async()=>{revalidatePath("/documents");revalidatePath("/transactions");revalidatePath("/calendar");});
  return {errorMessage:null};
 }catch(error){return {errorMessage:error instanceof Error?error.message:"שמירת הסכומים נכשלה."};}
 } finally {console.info("save_timing",{stage:"total",durationMs:Math.round(performance.now()-startedAt),timings});}
}
