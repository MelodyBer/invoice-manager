import type { DocumentRow } from "@/types/db";
import { validDate } from "./reporting";
function normalized(value: unknown): string { return typeof value === "string" ? value.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() : ""; }
export function documentsMayMatch(a: DocumentRow, b: DocumentRow): boolean {
 if (a.status==="processing" || b.status==="processing") return false;
 if (a.id===b.id || a.user_id!==b.user_id || a.direction!==b.direction || a.dismissed_at || b.dismissed_at) return false;
 const x=a.extraction_raw, y=b.extraction_raw;
 if (!x || !y || !((x.doc_type==="invoice_tax" && y.doc_type==="receipt") || (y.doc_type==="invoice_tax" && x.doc_type==="receipt"))) return false;
 const name=normalized(x.counterparty_name), other=normalized(y.counterparty_name);
 const business=normalized(x.business_number), otherBusiness=normalized(y.business_number);
 if (business && otherBusiness ? business!==otherBusiness : !name || name!==other) return false;
 if (typeof x.amount_total!=="number" || typeof y.amount_total!=="number" || !Number.isFinite(x.amount_total) || !Number.isFinite(y.amount_total) || x.amount_total<=0 || y.amount_total<=0 || Math.abs(Math.round(x.amount_total*100)-Math.round(y.amount_total*100))>1) return false;
 if ((x.currency ?? "ILS")!=="ILS" || (y.currency ?? "ILS")!=="ILS") return false;
 if (typeof x.doc_date!=="string" || typeof y.doc_date!=="string" || !validDate(x.doc_date) || !validDate(y.doc_date)) return false;
 const invoice=x.doc_type==="invoice_tax"?x:y, receipt=x.doc_type==="receipt"?x:y;
 const gap=(Date.parse(String(receipt.doc_date))-Date.parse(String(invoice.doc_date)))/86400000;
 return gap>=0 && gap<=90;
}
