"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "./load-range";
import type { TransactionRow } from "@/types/db";
export async function searchApprovedComplement(id:string,term:string):Promise<{transactions:TransactionRow[];error?:string}>{
 const {supabase,userId}=await userContext();
 const source=await supabase.from("transactions").select("*").eq("user_id",userId).eq("id",id).eq("is_verified",true).maybeSingle();
 if(source.error||!source.data||!["invoice_tax","receipt"].includes(source.data.doc_type))return {transactions:[],error:"אפשר לחבר רק חשבונית מס וקבלה מאושרות."};
 const text=term.replace(/[^\p{L}\p{N} ]/gu,"").trim().slice(0,80);
 let query=supabase.from("transactions").select("*").eq("user_id",userId).eq("is_verified",true).eq("direction",source.data.direction).eq("doc_type",source.data.doc_type==="receipt"?"invoice_tax":"receipt").eq("currency_review_required",false).not("document_id","is",null);
 if(text)query=query.or(`counterparty_name.ilike.%${text}%,doc_number.ilike.%${text}%`);
 const result=await query.order("doc_date",{ascending:false}).limit(20);
 return result.error?{transactions:[],error:"החיפוש נכשל. נסי שוב."}:{transactions:result.data??[]};
}
export async function mergeApprovedDocuments(invoiceId:string,receiptId:string,invoiceVersion:string,receiptVersion:string):Promise<{id?:string;error?:string}>{
 const {supabase}=await userContext();
 const {data,error}=await supabase.rpc("merge_approved_documents",{p_invoice_id:invoiceId,p_receipt_id:receiptId,p_invoice_version:invoiceVersion,p_receipt_version:receiptVersion});
 if(error)return {error:"החיבור לא הושלם. בדקי ששתי התנועות כוללות מסמך אחד כל אחת, שלא חוברו או שונו בינתיים, ושאין בהן מטבע שממתין לבדיקה. רענני ונסי שוב."};
 revalidatePath("/transactions");revalidatePath("/documents");revalidatePath("/calendar");revalidatePath(`/transactions/${invoiceId}`);revalidatePath(`/transactions/${receiptId}`);
 return {id:data};
}
