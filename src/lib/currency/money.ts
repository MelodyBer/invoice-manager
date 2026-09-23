import type { Currency, RateQuote } from "@/lib/calc";
export { convertMoney, shekelMoney } from "@/lib/calc";
export type { Currency, RateQuote, MonetaryValues, ConvertedMonetaryValues } from "@/lib/calc";
export function formatMoney(amount:number,currency:Currency):string {return new Intl.NumberFormat("he-IL",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);}
export function parseBoiCsv(csv:string, date:string): RateQuote | null {
 // BOI fields may be quoted; parse CSV without depending on an extra library.
 const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(field);field="";}else if(c==="\n"&&!quoted){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
 if(field||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
 const header=rows.shift()?.map(value=>value.replace(/^\uFEFF/,""))??[];
 const time=header.indexOf("TIME_PERIOD"),value=header.indexOf("OBS_VALUE"),series=header.indexOf("SERIES_CODE");
 if(time<0||value<0||series<0)return null;
 const available=rows.filter(r=>r[series]==="RER_USD_ILS"&&/^\d{4}-\d{2}-\d{2}$/.test(r[time])&&r[time]<=date&&Number(r[value])>0&&Number.isFinite(Number(r[value]))).sort((a,b)=>b[time].localeCompare(a[time]));
 return available[0]?{rate:Number(available[0][value]),rateDate:available[0][time],requestedDate:date,source:"בנק ישראל"}:null;
}
