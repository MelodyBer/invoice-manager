import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const providers = vi.hoisted(() => ({ account: vi.fn(), file: vi.fn(), recognition: vi.fn() }));
vi.mock("./gmail-api", async (original) => ({ ...await original<typeof import("./gmail-api")>(), gmailAccount: providers.account, getFile: providers.file }));
vi.mock("./gmail-recognition", () => ({ recognizeAttachment: providers.recognition }));
import { processItem, importItem, preview } from "./gmail-import";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
interface Result { data: unknown; error: null | { code?: string; message?: string } }
interface Query {
  select: (columns: string) => Query;
  update: (value: unknown) => Query;
  eq: (column: string, value: unknown) => Query;
  lt: (column: string, value: unknown) => Query;
  single: () => Promise<Result>;
  maybeSingle: () => Promise<Result>;
  then: <T = Result, E = never>(yes?: ((value: Result) => T | PromiseLike<T>) | null, no?: ((reason: unknown) => E | PromiseLike<E>) | null) => Promise<T | E>;
}
const id: string = "11111111-1111-4111-8111-111111111111";
const item = { id, user_id: "owner", mailbox: "test@example.com", message_id: "mail", part_id: "0", file_name: "bill.pdf", state: "pending", storage_path: null, document_id: null };
const ok = (data: unknown): Result => ({ data, error: null });
function database(results: Result[]) {
  const operations: { table: string; filters: [string, unknown][]; update?: unknown }[] = [];
  const upload = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ data: id, error: null });
  const next = (): Promise<Result> => {
    const value = results.shift();
    if (!value) throw new Error("unexpected database call");
    return Promise.resolve(value);
  };
  const from = (table: string): Query => {
    const operation: { table: string; filters: [string, unknown][]; update?: unknown } = { table, filters: [] }; operations.push(operation);
    const query: Query = {
      select: () => query,
      update: (value: unknown) => { operation.update = value; return query; },
      eq: (column: string, value: unknown) => { operation.filters.push([column, value]); return query; },
      lt: (column: string, value: unknown) => { operation.filters.push([column, value]); return query; },
      single: next, maybeSingle: next,
      then: (yes, no) => next().then(yes, no),
    };
    return query;
  };
  const supabase = { from, rpc, storage: { from: () => ({ upload }) } } as unknown as Supabase;
  return { supabase, operations, upload, rpc };
}
beforeEach(() => {
  vi.resetAllMocks();
  providers.account.mockResolvedValue({ mailbox: "test@example.com", token: "token" });
  providers.file.mockResolvedValue({ bytes: Buffer.from("%PDF-1.7"), part: { mimeType: "application/pdf" } });
  providers.recognition.mockResolvedValue({ financial: true, recipient: "Dana", confidence: 1, extraction: null });
});
describe("Gmail import transitions", () => {
  it("automatically queues an exact match without creating a transaction", async () => {
    const db = database([ok(item), ok({ recognition_names: ["Dana"] }), ok({ id }), ok({ id }), ok({ id }), ok({ ...item, state: "review", storage_path: `owner/2026/gmail-${id}.pdf` })]);
    await processItem(db.supabase, "owner", id);
    expect(db.upload).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("import_gmail_document", { p_item_id: id });
    expect(db.operations.every((operation) => operation.filters.some(([key, value]) => key === "user_id" && value === "owner"))).toBe(true);
    expect(db.operations.some((operation) => operation.table === "transactions")).toBe(false);
  });
  it("holds uncertain recipients for a user's decision", async () => {
    providers.recognition.mockResolvedValue({ financial: true, recipient: "Danna", confidence: 0.7, extraction: null });
    const db = database([ok(item), ok({ recognition_names: ["Dana"] }), ok({ id }), ok({ id }), ok({ id })]);
    await processItem(db.supabase, "owner", id);
    expect(db.operations.at(-1)?.update).toMatchObject({ state: "review" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("discards unrelated documents without storing their file or financial fields", async () => {
    providers.recognition.mockResolvedValue({ financial: true, recipient: "Other Person", confidence: 1, extraction: { amount_total: 100 } });
    const db = database([ok(item), ok({ recognition_names: ["Dana"] }), ok({ id }), ok({ id }), ok({ id })]);
    await processItem(db.supabase, "owner", id);
    expect(db.upload).not.toHaveBeenCalled();
    expect(db.operations.at(-1)?.update).toMatchObject({ state: "ignored", extraction_raw: null });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("skips identical bytes before paid recognition when another email already contains them", async () => {
    const db = database([ok(item), ok({ recognition_names: ["Dana"] }), ok({ id }), { data: null, error: { code: "23505" } }, ok(null)]);
    await processItem(db.supabase, "owner", id);
    expect(providers.recognition).not.toHaveBeenCalled();
    expect(db.upload).not.toHaveBeenCalled();
    expect(db.operations.at(-1)?.update).toMatchObject({ state: "duplicate" });
  });
  it("does not run a second worker while the first holds the claim", async () => {
    const db = database([ok({ ...item, state: "processing" }), ok({ recognition_names: ["Dana"] }), ok(null)]);
    await expect(processItem(db.supabase, "owner", id)).rejects.toThrow("כבר בבדיקה");
    expect(providers.account).not.toHaveBeenCalled();
  });
  it("records recognition failure and preserves a retry path", async () => {
    providers.recognition.mockRejectedValue(new Error("sensitive-provider-error"));
    const db = database([ok(item), ok({ recognition_names: ["Dana"] }), ok({ id }), ok({ id }), ok(null)]);
    await expect(processItem(db.supabase, "owner", id)).rejects.toThrow();
    expect(db.operations.at(-1)?.update).toMatchObject({ state: "failed", claim_token: null });
    expect(JSON.stringify(db.operations.at(-1)?.update)).not.toContain("sensitive-provider-error");
  });
  it("cannot preview another user's row", async () => {
    const db = database([{ data: null, error: { message: "not found" } }]);
    await expect(preview(db.supabase, "owner", id)).rejects.toThrow("לא נמצא");
    expect(db.operations[0].filters).toContainEqual(["user_id", "owner"]);
  });
  it("a retry of a completed import returns the same document without another write", async () => {
    const db = database([ok({ ...item, state: "imported", document_id: id })]);
    await expect(importItem(db.supabase, "owner", id)).resolves.toBe(id);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("cannot import a rejected or unprocessed candidate", async () => {
    const db = database([ok({ ...item, state: "ignored" })]);
    await expect(importItem(db.supabase, "owner", id)).rejects.toThrow("לא מוכן");
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
