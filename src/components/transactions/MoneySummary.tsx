import type { FinancialColumns } from "@/types/db";
import { formatMoney } from "@/lib/currency/money";
import { formatDateDDMMYYYY } from "@/lib/format";
export function MoneySummary({value,date,needsReview=false}:{value:FinancialColumns & {currency:string|null;amount_total:number|null};date?:string|null;needsReview?:boolean}):React.JSX.Element{
 if(needsReview)return <p role="alert" className="rounded border border-warning p-3">התנועה הישנה דורשת בדיקת מטבע. לחצי עריכה, בדקי את הסכום המקורי ושמרי כדי לחשב את ההמרה. עד אז היא אינה נכללת בסיכומים.</p>;
 return <div className="my-3 rounded border border-border bg-primary/5 p-3 text-sm">
 <p>מטבע המסמך: {value.currency==="USD"?"דולר אמריקאי":value.currency==="ILS"?"שקל":"טרם אושר"}</p>
 {date&&<p>תאריך המסמך: {formatDateDDMMYYYY(date)}</p>}
 {value.original_amount_total!==null&&(value.currency==="USD"||value.currency==="ILS")&&<p>סכום מקורי: {formatMoney(value.original_amount_total,value.currency)}</p>}
 {value.amount_total!==null&&<p>בשקלים: {formatMoney(value.amount_total,"ILS")}</p>}
 {value.amount_total_usd!==null&&<p>בדולרים: {formatMoney(value.amount_total_usd,"USD")}</p>}
 {value.exchange_rate!==null&&value.exchange_rate_date?<p>שער בנק ישראל: {value.exchange_rate.toFixed(4)} ₪ לדולר, מיום {formatDateDDMMYYYY(value.exchange_rate_date)}</p>:value.currency==="USD"?<p>למסמך הישן עדיין לא נשמר שער. שמירה בעריכה תחשב אותו לפי תאריך המסמך.</p>:null}
 </div>;
}
