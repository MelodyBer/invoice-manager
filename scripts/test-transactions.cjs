const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name === "@/lib/currency/boi") return { getBoiRate: async date => ({rate:3.125,rateDate:date,requestedDate:date,source:"בנק ישראל"}) };
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts", mocks);
    if (name.startsWith("./")) return load(path.join(path.dirname(file), name + ".ts"), mocks);
    return require(name);
  };
  new Function("exports", "module", "require", output)(mod.exports, mod, localRequire);
  return mod.exports;
}
const report = load("src/lib/transactions/reporting.ts");
assert.deepEqual(report.resolveRange({ preset: "previous" }, "monthly", "2026-01-12"), { start: "2025-12-01", end: "2025-12-31", preset: "previous" });
assert.equal(report.resolveRange({ preset: "period" }, "bimonthly", "2026-02-10").start, "2026-01-01");
assert.equal(report.resolveRange({ preset: "period" }, "bimonthly", "2026-12-31").end, "2026-12-31");
assert.equal(report.resolveRange({ preset: "period" }, "monthly", "2026-02-10").start, "2026-02-01");
assert.equal(report.monthRange("2024-02").end, "2024-02-29");
assert.throws(() => report.resolveRange({ preset: "custom", start: "2026-09-30", end: "2026-09-01" }, "monthly"));
assert.equal(report.validDate("2026-02-31"), false);
assert.equal(report.israelMidnight("2026-01-01"), "2025-12-31T22:00:00.000Z");
assert.equal(report.israelMidnight("2026-07-01"), "2026-06-30T21:00:00.000Z");
assert.deepEqual(report.summarize([{ direction: "income", amount_total: 1180, vat_amount: 180 }, { direction: "expense", amount_total: 590, vat_amount: 90, vat_deductible_percent: 66 }]), { income: 1180, expense: 590, vat: 120.6 });
assert.deepEqual(report.summarize([]), { income: 0, expense: 0, vat: 0 });
const fixture = Array.from({ length: 101 }, (_, i) => ({ id: String(i), direction: "income", doc_date: "2026-09-01", counterparty_name: "ספק", doc_number: String(i), category_id: "a", document_id: null, amount_before_vat: 1, vat_amount: 0, vat_deductible_percent: 100, amount_total: i + 1 }));
const page1 = report.filterAndPage(fixture, { sort: "amount_total", order: "asc" }, { a: "ראשונה" });
const page2 = report.filterAndPage(fixture, { sort: "amount_total", order: "asc", page: "2" }, { a: "ראשונה" });
assert.equal(page1.rows.length, 50); assert.equal(page2.rows.length, 50);
assert.equal(page1.rows[0].amount_total, 1); assert.equal(page2.rows[0].amount_total, 51);
assert.equal(page1.totals.income, 5151); assert.deepEqual(page1.totals, page2.totals);
assert.equal(report.filterAndPage(fixture, { page: "999" }, {}).rows.length, 1);
assert.equal(report.filterAndPage(fixture, { q: "100" }, {}).count, 1);
assert.equal(report.filterAndPage(fixture, { direction: "expense" }, {}).count, 0);
assert.equal(report.filterAndPage(fixture, { category: "other" }, {}).count, 0);
const { formatDateDDMMYYYY } = load("src/lib/format.ts");
assert.equal(formatDateDDMMYYYY("2026-09-01"), "01/09/2026");
assert.equal(formatDateDDMMYYYY("2026-08-31T22:30:00Z"), "01/09/2026");
// Simulated Supabase calls: no network, credentials or live data.
function database(responses) {
  const calls = []; let index = 0;
  return { calls, rpc(name,args) { calls.push({rpc:name,args}); return Promise.resolve(responses[index++]); }, from(table) {
    const trace = { table, steps: [] }; calls.push(trace);
    const query = {};
    for (const method of ["select", "eq", "neq", "is", "gte", "lte", "order", "range", "limit", "update", "delete", "in"])
      query[method] = (...args) => { trace.steps.push([method, ...args]); return query; };
    query.then = (resolve, reject) => Promise.resolve(responses[index++]).then(resolve, reject);
    query.maybeSingle = () => query;
    return query;
  }, storage: { from() { return { remove: async () => { calls.push({ storage: true }); return { error: null }; } }; } } };
}
(async () => {
  const { findApprovedDuplicateId } = load("src/lib/transactions/duplicate-check.ts");
  const duplicateParams = { counterpartyName: " ספק ", docNumber: " 123 ", docDate: "2026-09-01", docType: "receipt", direction: "expense" };
  const approvedDb = database([{ data: { id: "approved" }, error: null }]);
  assert.equal(await findApprovedDuplicateId(approvedDb, "owner", duplicateParams), "approved");
  for (const [column, value] of Object.entries({ user_id: "owner", is_verified: true, counterparty_name: "ספק", doc_number: "123", doc_date: "2026-09-01", doc_type: "receipt", direction: "expense" })) {
    assert.ok(approvedDb.calls[0].steps.some(step => step[0] === "eq" && step[1] === column && step[2] === value), `Missing approved duplicate filter: ${column}`);
  }
  const blankDb = database([]);
  assert.equal(await findApprovedDuplicateId(blankDb, "owner", { ...duplicateParams, docDate: "" }), null);
  assert.equal(await findApprovedDuplicateId(blankDb, "owner", { ...duplicateParams, counterpartyName: " " }), null);
  assert.equal(blankDb.calls.length, 0);
  const nullNumberDb = database([{data: null, error: null}]);
  assert.equal(await findApprovedDuplicateId(nullNumberDb, "owner", { ...duplicateParams, docNumber: "" }), null);
  assert.ok(nullNumberDb.calls[0].steps.some(step => step[0] === "is" && step[1] === "doc_number" && step[2] === null));
  await assert.rejects(() => findApprovedDuplicateId(database([{data: null, error: {message: "offline"}}]), "owner", duplicateParams));
  console.log("Passed: early duplicate detection scopes verified records by owner and document type, trims identifiers, skips incomplete fields and surfaces failures.");

  const sourceInvoice = { id: "source", user_id: "owner", direction: "expense", status: "processed", extraction_raw: { doc_type: "invoice_tax", doc_date: "2026-09-01", counterparty_name: "Supplier", amount_total: 100, currency: "ILS" } };
  const receiptBatch = Array.from({length: 30}, (_, i) => ({ ...sourceInvoice, id: `receipt-${i}`, extraction_raw: {...sourceInvoice.extraction_raw, doc_type: "receipt"} }));
  const matchingDb = database([{data: sourceInvoice, error: null}, {data: receiptBatch, error: null}, {data: [], error: null}]);
  const matchingActions = load("src/lib/transactions/pair-actions.ts", {"next/cache": {revalidatePath() {}}, "./load-range": {userContext: async () => ({supabase: matchingDb, userId: "owner"})}});
  assert.equal((await matchingActions.findDocumentPairs("source")).candidates.length, 30);
  assert.equal(matchingDb.calls.length, 3, "Thirty documents require one batched transaction query, not thirty individual queries");
  for (const call of matchingDb.calls) assert.ok(call.steps.some(step => step[0] === "eq" && step[1] === "user_id" && step[2] === "owner"));
  assert.ok(matchingDb.calls[2].steps.some(step => step[0] === "in" && step[1] === "document_id" && step[2].length === 30));
  console.log("Passed: matching thirty documents uses three scoped queries including source and document batch.");
  const db = database([{ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }, { data: [{ id: 501 }], error: null }]);
  const { loadRange } = load("src/lib/transactions/load-range.ts", { "next/navigation": {}, "@/lib/supabase/server": {} });
  assert.equal((await loadRange(db, "owner", "2026-09-01", "2026-09-30")).length, 501);
  for (const call of db.calls) {
    assert.ok(call.steps.some(step => step[0] === "eq" && step[1] === "user_id" && step[2] === "owner"));
    assert.ok(call.steps.some(step => step[0] === "gte" && step[1] === "doc_date"));
    assert.ok(call.steps.some(step => step[0] === "lte" && step[1] === "doc_date"));
  }
  assert.deepEqual(db.calls[1].steps.find(step => step[0] === "range"), ["range", 500, 999]);
  const actions = db => load("src/lib/transactions/detail-actions.ts", { "next/cache": { revalidatePath() {} }, "./load-range": { userContext: async () => ({ supabase: db, userId: "owner" }) } });
  const foreign = database([{ data: null, error: null }]);
  assert.ok((await actions(foreign).getDetail("foreign-id")).error);
  assert.equal(foreign.calls.length, 1);
  assert.ok(foreign.calls[0].steps.some(step => step[1] === "user_id" && step[2] === "owner"));
  const shared = database([{ data: { document_id: "doc" }, error: null }, { data: [{ id: "doc", transaction_id: "id", storage_path: "owner/doc" }], error: null }, { count: 1, error: null }]);
  assert.ok((await actions(shared).deleteTransaction("id")).error);
  assert.equal(shared.calls.some(call => call.storage), false);
  const manual = database([{ data: { document_id: null }, error: null }, { data: [], error: null }, { data: [{ id: "id" }], error: null }]);
  assert.equal((await actions(manual).deleteTransaction("id")).success, true);
  assert.equal(manual.calls.some(call => call.storage), false);
  const values = { currency: "ILS", direction: "expense", counterpartyName: "test", docNumber: "1", notes: "", docType: "invoice_tax", docDate: "2026-09-01", amountBeforeVat: "100", vatAmount: "18", amountTotal: "118", vatRate: "18", vatDeductiblePercent: 100, categoryId: null };
  const stale = database([{ data: null, error: null }, { data: {document_id:null}, error: null }, { data:null,error:{message:"stale"} }]);
  assert.ok((await actions(stale).updateTransaction("id", values, "old-timestamp")).error);
  assert.equal(stale.calls.find(call=>call.rpc)?.args.p_expected_updated_at,"old-timestamp");
  const duplicate = database([{ data: { id: "duplicate" }, error: null }]);
  assert.equal((await actions(duplicate).updateTransaction("id", values, "timestamp")).duplicateId, "duplicate");
  assert.equal(duplicate.calls.length, 1);
  console.log("Passed: date ranges, leap year, Jerusalem boundaries, VAT recognition, pagination beyond 500, owner scoping, shared-file protection, manual deletion, stale edits and duplicate detection.");
})().catch(error => { console.error(error); process.exitCode = 1; });

// Exercise the real form hook with a minimal state harness; no live data.
let hookStates = []; let hookIndex = 0;
const hook = load("src/lib/transactions/use-transaction-form.ts", { react: {
  useCallback: callback => callback,
  useState: initial => { const index = hookIndex++; if (!(index in hookStates)) hookStates[index] = initial; return [hookStates[index], value => { hookStates[index] = typeof value === "function" ? value(hookStates[index]) : value; }]; }
} });
const initial = { vatRate: "18", amountBeforeVat: "100", vatAmount: "18", amountTotal: "118", vatDeductiblePercent: 100 };
function renderForm() { hookIndex = 0; return hook.useTransactionForm(initial); }
renderForm().setField({ vatAmount: "20" });
assert.equal(renderForm().isVatManuallyEdited, true);
renderForm().setField({ vatRate: "0" });
assert.equal(renderForm().isVatManuallyEdited, false);
assert.equal(renderForm().values.amountTotal, "120");
assert.equal(renderForm().values.amountBeforeVat, "120");
assert.equal(renderForm().values.vatAmount, "0");
renderForm().setField({ amountTotal: "250.50" });
assert.equal(renderForm().values.amountBeforeVat, "250.50");
renderForm().setField({ vatDeductiblePercent: 100 });
assert.equal(renderForm().values.vatDeductiblePercent, 0);
renderForm().setField({ amountBeforeVat: "300" });
assert.equal(renderForm().values.amountTotal, "300");
renderForm().setField({ vatRate: "18" });
assert.equal(renderForm().values.vatAmount, "54");
const validation = load("src/lib/extraction/validate-result.ts");
const extracted = validation.applyBusinessValidation({ amount_before_vat: 100, vat_amount: 0, amount_total: 120, vat_rate: 0, doc_date: "2026-01-01", notes: null });
assert.equal(extracted.amount_before_vat, 120);
assert.equal(extracted.vat_amount, 0);
console.log("Passed: no-VAT preserves paid total, resets manual VAT, keeps category deduction at zero, supports amount edits and zero-rate extraction correction.");

(async () => {
  const { loadReviewQueue } = load("src/lib/transactions/review-queue.ts");
  const db = database([{ data: [{ id: "approved" }, { id: "waiting" }], error: null }, { data: [{ document_id: "approved" }], error: null }]);
  assert.deepEqual(await loadReviewQueue(db, "owner"), [{ id: "waiting" }]);
  for (const call of db.calls) assert.ok(call.steps.some(step => step[0] === "eq" && step[1] === "user_id" && step[2] === "owner"));
  assert.ok(db.calls[1].steps.some(step => step[0] === "eq" && step[1] === "is_verified" && step[2] === true));
  const failed = database([{ data: [{ id: "a" }], error: null }, { data: null, error: { message: "failure" } }]);
  await assert.rejects(() => loadReviewQueue(failed, "owner"));
  const paged = database([{ data: Array.from({ length: 200 }, (_, i) => ({ id: String(i) })), error: null }, { data: [], error: null }, { data: [{ id: "last" }], error: null }, { data: [], error: null }]);
  assert.equal((await loadReviewQueue(paged, "owner")).length, 201);
  const { extractionInstruction } = load("src/lib/extraction/schema.ts");
  assert.match(extractionInstruction("income"), /שם הלקוח/);
  assert.match(extractionInstruction("expense"), /שם הספק/);
  assert.notEqual(extractionInstruction("income"), extractionInstruction("expense"));
  console.log("Passed: approved documents excluded, user isolation filters, queue pagination, errors not treated as empty, direction-aware extraction instructions.");
})().catch(error => { console.error(error); process.exitCode = 1; });

const { documentsMayMatch } = load("src/lib/transactions/document-matching.ts");
const invoice = {id:"invoice",user_id:"owner",direction:"expense",extraction_raw:{doc_type:"invoice_tax",counterparty_name:"עסק לדוגמה",amount_total:118,currency:"ILS",doc_date:"2026-09-01"}};
const receipt = {id:"receipt",user_id:"owner",direction:"expense",extraction_raw:{...invoice.extraction_raw,doc_type:"receipt",doc_date:"2026-09-03"}};
assert.equal(documentsMayMatch(invoice,receipt),true);
assert.equal(documentsMayMatch(receipt,invoice),true);
assert.equal(documentsMayMatch(invoice,{...receipt,user_id:"other"}),false);
assert.equal(documentsMayMatch(invoice,{...receipt,direction:"income"}),false);
assert.equal(documentsMayMatch(invoice,{...receipt,dismissed_at:"2026-09-01"}),false);
for (const patch of [{amount_total:59},{currency:"USD"},{counterparty_name:"עסק אחר"},{doc_date:"2025-01-01"},{doc_date:"2027-01-01"},{doc_type:"invoice_tax_receipt"},{doc_date:null}]) {
 assert.equal(documentsMayMatch(invoice,{...receipt,extraction_raw:{...receipt.extraction_raw,...patch}}),false);
}
assert.equal(documentsMayMatch({...invoice,extraction_raw:{...invoice.extraction_raw,business_number:"123"}},{...receipt,extraction_raw:{...receipt.extraction_raw,business_number:"456"}}),false);
console.log("Passed: complementary documents, different owner/direction/currency/party, partial payments, invalid/distant dates, combined receipts and removed files.");

assert.equal(documentsMayMatch(invoice,{...receipt,status:"processing"}),false);
assert.equal(documentsMayMatch(invoice,{...receipt,extraction_raw:{...receipt.extraction_raw,amount_total:NaN}}),false);
assert.equal(documentsMayMatch({...invoice,extraction_raw:{...invoice.extraction_raw,currency:"USD"}},{...receipt,extraction_raw:{...receipt.extraction_raw,currency:"USD"}}),true);

const { approvedDocument } = load("src/lib/transactions/document-matching.ts");
const oldInvoice={...invoice,extraction_raw:{...invoice.extraction_raw,counterparty_name:"זיהוי שגוי",amount_total:999}};
const savedInvoice={id:"saved",user_id:"owner",document_id:"invoice",is_verified:true,direction:"expense",doc_type:"invoice_tax",counterparty_name:invoice.extraction_raw.counterparty_name,doc_date:"2026-09-01",amount_total:118,amount_before_vat:100,vat_amount:18,vat_rate:18,currency:"ILS",updated_at:"version"};
assert.equal(documentsMayMatch(receipt,oldInvoice),false);
assert.equal(documentsMayMatch(receipt,approvedDocument(oldInvoice,savedInvoice)),true);
assert.equal(approvedDocument(oldInvoice,{...savedInvoice,user_id:"other"}),oldInvoice);
(async()=>{
 const db=database([{data:receipt,error:null},{data:savedInvoice,error:null},{data:oldInvoice,error:null}]);
 const actions=load("src/lib/transactions/pair-actions.ts",{"next/cache":{revalidatePath(){}},"./load-range":{userContext:async()=>({supabase:db,userId:"owner"})}});
 const result=await actions.resolveInvoiceDuplicate("receipt","saved");
 assert.equal(result.candidate.transaction.id,"saved");
 assert.equal(result.candidate.document.extraction_raw.amount_total,118);
 for(const call of db.calls) assert.ok(call.steps.some(step=>step[0]==="eq"&&step[1]==="user_id"&&step[2]==="owner"));
 console.log("Passed: corrected approved invoice used for matching; duplicate receipt resolves to existing transaction with owner filtering.");
})().catch(error=>{console.error(error);process.exitCode=1;});
