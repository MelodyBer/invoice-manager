"use server";
import { userContext } from "@/lib/transactions/load-range";
import { getBoiRate } from "./boi";
import type { RateQuote } from "./money";
export async function loadRate(date:string):Promise<{quote?:RateQuote;error?:string}>{
 await userContext();
 try{return {quote:await getBoiRate(date)};}catch(error){return {error:error instanceof Error?error.message:"טעינת השער נכשלה."};}
}
