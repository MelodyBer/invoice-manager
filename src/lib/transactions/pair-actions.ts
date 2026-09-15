"use server";
import { revalidatePath } from "next/cache";
import { userContext } from "./load-range";
import { validDate } from "./reporting";
import { documentsMayMatch } from "./document-matching";
import { validateTransactionValues } from "./validate-values";
import { transactionPayload } from "./transaction-payload";
import type { TransactionFormValues } from "@/types/transaction-form";
import type { DocumentRow, TransactionRow } from "@/types/db";
export type PairCandidate = { document: DocumentRow; transaction: TransactionRow | null };
export async function findDocumentPairs(id: string): Promise<{ candidates: PairCandidate[]; error?: string }> {
 const {supabase,userId}=await userContext();
 const source=await supabase.from("documents").select("*").eq("user_id",userId).eq("id",id).maybeSingle();
 if(source.error || !source.data) return {candidates:[],error:"לא ניתן לבדוק מסמכים מתאימים."};
 const candidates: PairCandidate[]=[];
 const kind=source.data.extraction_raw?.doc_type;
 if(kind!=="invoice_tax" && kind!=="receipt") return {candidates};
 const sourceDate=source.data.extraction_raw?.doc_date;
 if(typeof sourceDate!=="string" || !validDate(sourceDate)) return {candidates};
 const before=new Date(Date.parse(sourceDate)-90*86400000).toISOString().slice(0,10);
 const after=new Date(Date.parse(sourceDate)+90*86400000).toISOString().slice(0,10);
 for(let offset=0;;offset+=200) {
   const batch=await supabase.from("documents").select("*").eq("user_id",userId).eq("direction",source.data.direction).is("dismissed_at",null).gte("extraction_raw->>doc_date",before).lte("extraction_raw->>doc_date",after).eq("extraction_raw->>doc_type",kind==="invoice_tax"?"receipt":"invoice_tax").order("id").range(offset,offset+199);
   if(batch.error) return {candidates:[],error:"בדיקת ההתאמה נכשלה. רענני לפני האישור."};
   for(const document of batch.data ?? []) {
     if(!documentsMayMatch(source.data,document)) continue;
     const query=supabase.from("transactions").select("*").eq("user_id",userId);
     const linked=document.transaction_id ? await query.eq("id",document.transaction_id).maybeSingle() : await query.eq("document_id",document.id).limit(1).maybeSingle();
     if(linked.error) return {candidates:[],error:"לא ניתן לבדוק את התנועה המקושרת."};
     candidates.push({document,transaction:linked.data});
   }
   if((batch.data ?? []).length<200) return {candidates};
 }
}
export async function approveDocumentPair(id: string, otherId: string, values: TransactionFormValues, expectedUpdatedAt: string | null): Promise<{errorMessage: string | null}> {
 const error=validateTransactionValues(values); if(error) return {errorMessage:error};
 const {supabase,userId}=await userContext();
 const result=await supabase.from("documents").select("*").eq("user_id",userId).in("id",[id,otherId]);
 if(result.error || result.data?.length!==2 || !documentsMayMatch(result.data[0],result.data[1])) return {errorMessage:"המסמכים אינם מתאימים לחיבור. רענני ובדקי אותם."};
 const {error:saveError}=await supabase.rpc("confirm_documents",{p_document_ids:[id,otherId],p_values:transactionPayload(values),p_expected_updated_at:expectedUpdatedAt ?? undefined});
 if(saveError) return {errorMessage:"החיבור לא נשמר. ייתכן שמסמך כבר אושר או השתנה. רענני ובדקי; לא נוצר חיבור חלקי."};
 revalidatePath("/documents"); revalidatePath("/transactions"); revalidatePath("/calendar");
 return {errorMessage:null};
}
export async function dismissDocument(id: string): Promise<{error?:string}> {
 const {supabase}=await userContext();
 const {error}=await supabase.rpc("dismiss_review_document",{p_document_id:id});
 if(error) return {error:"לא ניתן להסיר. ייתכן שהמסמך כבר אושר או השתנה. רענני ונסי שוב."};
 revalidatePath("/documents"); return {};
}
