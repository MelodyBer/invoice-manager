"use server";
import { userContext } from "./load-range";
import { prepareFinancialValues,documentFinancialValues } from "./financial-server";
import { revalidatePath } from "next/cache";
import type { TransactionRow } from "@/types/db";
import type { TransactionFormValues } from "@/types/transaction-form";
export async function searchInvoices(documentId:string,term:string):Promise<{invoices:TransactionRow[];error?:string}>{
 const {supabase,userId}=await userContext();
 const source=await supabase.from("documents").select("direction").eq("user_id",userId).eq("id",documentId).maybeSingle();
 if(source.error||!source.data)return {invoices:[],error:"המסמך לא נמצא."};
 const search=term.replace(/[^\p{L}\p{N} ]/gu,"").trim().slice(0,80);
 let query=supabase.from("transactions").select("*").eq("user_id",userId).eq("is_verified",true).eq("doc_type","invoice_tax").eq("direction",source.data.direction);
 if(search)query=query.or(`counterparty_name.ilike.%${search}%,doc_number.ilike.%${search}%`);
 const result=await query.order("doc_date",{ascending:false}).limit(20);
 return result.error?{invoices:[],error:"חיפוש החשבוניות נכשל. נסי שוב."}:{invoices:result.data??[]};
}
export async function attachReceipt(documentId:string,invoiceId:string,expectedUpdatedAt:string,values:TransactionFormValues):Promise<{error?:string}>{
 const {supabase,userId}=await userContext();
 if(values.docType!=="receipt")return {error:"יש לבחור קבלה בסוג המסמך כדי לצרף אותה לחשבונית."};
 const invoice=await supabase.from("transactions").select("*").eq("user_id",userId).eq("id",invoiceId).eq("doc_type","invoice_tax").eq("is_verified",true).maybeSingle();
 if(invoice.error||!invoice.data||invoice.data.direction!==values.direction)return {error:"לא נמצאה חשבונית מתאימה בבעלותך."};
 if(invoice.data.currency_review_required)return {error:"יש לבדוק ולשמור קודם את המטבע בחשבונית הישנה דרך עריכת התנועה."};
 try{
  const prepared=await prepareFinancialValues(values);
  const {error}=await supabase.rpc("save_financial_record",{p_values:{},p_document_values:{[documentId]:documentFinancialValues(values,prepared)},p_transaction_id:invoiceId,p_expected_updated_at:expectedUpdatedAt,p_attach_only:true});
  if(error)return {error:"הצירוף לא הושלם. ייתכן שהחשבונית השתנתה או שהקבלה כבר אושרה. רענני ונסי שוב."};
  revalidatePath("/documents");revalidatePath("/transactions");revalidatePath(`/transactions/${invoiceId}`);revalidatePath("/calendar");
  return {};
 }catch(error){return {error:error instanceof Error?error.message:"הצירוף נכשל. נסי שוב."};}
}
