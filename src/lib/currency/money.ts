export type Currency = "ILS" | "USD";
export interface RateQuote { rate: number; rateDate: string; requestedDate: string; source: "בנק ישראל"; }
export interface MonetaryValues {
 currency: Currency; original_amount_before_vat: number; original_vat_amount: number; original_amount_total: number;
 exchange_rate: number; exchange_rate_date: string; amount_before_vat: number; vat_amount: number; amount_total: number; amount_total_usd: number;
}
function roundedDivide(numerator: bigint, denominator: bigint): bigint { return (numerator + denominator / BigInt(2)) / denominator; }
export function convertMoney(currency: Currency, before: number, vat: number, total: number, quote: RateQuote): MonetaryValues {
 if (!["ILS","USD"].includes(currency)) throw new Error("מטבע לא נתמך.");
 if (![before,vat,total,quote.rate].every(Number.isFinite) || before<0 || vat<0 || total<=0 || quote.rate<=0 || Math.abs(Math.round(before*100)+Math.round(vat*100)-Math.round(total*100))>1) throw new Error("סכומים או שער לא תקינים.");
 const rate=BigInt(Math.round(quote.rate*1e8)), scale=BigInt(100000000);
 if(rate<=BigInt(0)) throw new Error("שער ההמרה אינו תקין.");
 const cents=(value:number):bigint=>BigInt(Math.round(value*100));
 const toIls=(value:number):number=>currency==="ILS"?Number(cents(value))/100:Number(roundedDivide(cents(value)*rate,scale))/100;
 const ilsTotal=toIls(total), ilsBefore=toIls(before);
 const usdTotal=currency==="USD"?total:Number(roundedDivide(cents(total)*scale,rate))/100;
 if ([ilsTotal,ilsBefore,usdTotal,total].some(value=>value>=1e10)) throw new Error("הסכום גדול מדי לשמירה.");
 return {currency,original_amount_before_vat:before,original_vat_amount:vat,original_amount_total:total,exchange_rate:quote.rate,exchange_rate_date:quote.rateDate,amount_before_vat:ilsBefore,vat_amount:Math.round((ilsTotal-ilsBefore)*100)/100,amount_total:ilsTotal,amount_total_usd:usdTotal};
}
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
