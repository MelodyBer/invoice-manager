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
  return { calls, from(table) {
    const trace = { table, steps: [] }; calls.push(trace);
    const query = {};
    for (const method of ["select", "eq", "neq", "is", "gte", "lte", "order", "range", "limit", "update", "delete"])
      query[method] = (...args) => { trace.steps.push([method, ...args]); return query; };
    query.then = (resolve, reject) => Promise.resolve(responses[index++]).then(resolve, reject);
    query.maybeSingle = () => query;
    return query;
  }, storage: { from() { return { remove: async () => { calls.push({ storage: true }); return { error: null }; } }; } } };
}
(async () => {
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
  const shared = database([{ data: { document_id: "doc" }, error: null }, { count: 1, error: null }]);
  assert.ok((await actions(shared).deleteTransaction("id")).error);
  assert.equal(shared.calls.some(call => call.storage), false);
  const manual = database([{ data: { document_id: null }, error: null }, { data: [{ id: "id" }], error: null }]);
  assert.equal((await actions(manual).deleteTransaction("id")).success, true);
  assert.equal(manual.calls.some(call => call.storage), false);
  const values = { direction: "expense", counterpartyName: "test", docNumber: "1", notes: "", docType: "invoice_tax", docDate: "2026-09-01", amountBeforeVat: "100", vatAmount: "18", amountTotal: "118", vatRate: "18", vatDeductiblePercent: 100, categoryId: null };
  const stale = database([{ data: null, error: null }, { data: [], error: null }]);
  assert.ok((await actions(stale).updateTransaction("id", values, "old-timestamp")).error);
  assert.ok(stale.calls[1].steps.some(step => step[1] === "updated_at" && step[2] === "old-timestamp"));
  const duplicate = database([{ data: { id: "duplicate" }, error: null }]);
  assert.equal((await actions(duplicate).updateTransaction("id", values, "timestamp")).duplicateId, "duplicate");
  assert.equal(duplicate.calls.length, 1);
  console.log("Passed: date ranges, leap year, Jerusalem boundaries, VAT recognition, pagination beyond 500, owner scoping, shared-file protection, manual deletion, stale edits and duplicate detection.");
})().catch(error => { console.error(error); process.exitCode = 1; });
