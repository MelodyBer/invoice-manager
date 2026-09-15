"use client";
import { useEffect,useState } from "react";
import { loadRate } from "@/lib/currency/actions";
import { convertMoney,formatMoney,type RateQuote } from "@/lib/currency/money";
import type { TransactionFormValues } from "@/types/transaction-form";
import { formatDateDDMMYYYY } from "@/lib/format";
export function CurrencyPreview({values}:{values:TransactionFormValues}):React.JSX.Element{
 const [quote,setQuote]=useState<RateQuote|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setQuote(null);setError("");if(!values.docDate)return;void loadRate(values.docDate).then(result=>{if(active){setQuote(result.quote??null);setError(result.error??"");}}).catch(()=>{if(active)setError("טעינת השער נכשלה. נסי שוב.");});return()=>{active=false;};},[values.docDate,retry]);
 let money:ReturnType<typeof convertMoney>|null=null;
 if(quote?.requestedDate===values.docDate&&(values.currency==="USD"||values.currency==="ILS")){try{money=convertMoney(values.currency,Number(values.amountBeforeVat),Number(values.vatAmount),Number(values.amountTotal),quote);}catch{/* Shown by form validation before save. */}}
 return <div className="rounded-lg border border-border bg-primary/5 p-3 text-sm" aria-live="polite">
 {!values.docDate?<p>בחרי תאריך כדי לחשב את השער.</p>:error?<p role="alert">{error} <button type="button" className="underline" onClick={()=>setRetry(value=>value+1)}>נסה שוב</button></p>:!quote?<p>טוען שער מבנק ישראל…</p>:<><p>שער בנק ישראל: 1 דולר = {quote.rate.toFixed(4)} ₪</p><p>תאריך השער: {formatDateDDMMYYYY(quote.rateDate)}{quote.rateDate!==values.docDate?" — השער האחרון שפורסם לפני תאריך המסמך":""}</p>{money&&<p className="mt-2 font-semibold">{formatMoney(money.amount_total_usd,"USD")} · {formatMoney(money.amount_total,"ILS")}</p>}<p className="mt-1">הסיכומים במערכת מחושבים בשקלים. המטבע והסכום המקוריים נשמרים.</p></>}
 </div>;
}
