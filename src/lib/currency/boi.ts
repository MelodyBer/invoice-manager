import "server-only";
import { parseBoiCsv, type RateQuote } from "./money";
import { todayIsrael, validDate } from "@/lib/transactions/reporting";
export async function getBoiRate(date:string):Promise<RateQuote>{
 if(!validDate(date)||date<"2020-01-01"||date>todayIsrael())throw new Error("יש לבחור תאריך תקין מ־2020 ועד היום.");
 for(const days of [30,365,3650]){
  const start=new Date(Date.parse(date)-days*86400000).toISOString().slice(0,10);
  const url=new URL("https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS");
  url.searchParams.set("startPeriod",start);url.searchParams.set("endPeriod",date);url.searchParams.set("format","csv");
  let response:Response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(15000),next:{revalidate:date===todayIsrael()?300:86400}});}catch{throw new Error("לא ניתן לקבל שער מבנק ישראל. נסי שוב; לא יישמר שער משוער.");}
  if(!response.ok)throw new Error("שירות השערים אינו זמין כרגע. נסי שוב.");
  const quote=parseBoiCsv(await response.text(),date);if(quote)return quote;
 }
 throw new Error("לא נמצא שער לתאריך זה או לפניו.");
}
