"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { dismissDocument } from "@/lib/transactions/pair-actions";
export function RemoveReviewDocument({id, returnToList=false}: {id:string; returnToList?:boolean}): React.JSX.Element {
 const router=useRouter(); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function remove(): Promise<void> {
   if(busy)return;setBusy(true);setError("");
   try {const result=await dismissDocument(id);if(result.error)setError(result.error);else{setOpen(false);if(returnToList)router.replace("/documents");router.refresh();}}
   catch{setError("ההסרה נכשלה. בדקי את החיבור ונסי שוב.");}finally{setBusy(false);}
 }
 return <><Button variant="ghost" onClick={()=>setOpen(true)}>הסר מהאישור</Button><Dialog isOpen={open} onClose={()=>{if(!busy)setOpen(false);}} title="להסיר את המסמך מרשימת האישורים?"><p>המסמך לא ייצור תנועה ולא יופיע שוב בתור. הקובץ נשמר באחסון ואינו נמחק לצמיתות.</p>{error&&<p role="alert">{error}</p>}<div className="mt-4 flex gap-3"><Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>ביטול</Button><Button isLoading={busy} onClick={()=>void remove()}>הסר מהאישור</Button></div></Dialog></>;
}
