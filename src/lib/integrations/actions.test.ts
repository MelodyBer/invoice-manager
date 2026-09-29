import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(), from: vi.fn(), verify: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/lib/transactions/load-range", () => ({ userContext: async () => ({ userId: "authenticated-owner", supabase: { from: mocks.from } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/integrations/providers", async (original) => ({ ...await original<typeof import("./providers")>(), verifyPayplus: mocks.verify }));
import { connectPayplus, saveRecognitionNames, disconnectIntegration } from "@/app/(app)/settings/integrations/actions";
import { unseal } from "./security";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "ab".repeat(32));
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

function keys(): FormData {
  const form = new FormData();
  form.set("apiKey", "example-key");
  form.set("secretKey", "example-secret");
  form.set("user_id", "another-owner");
  return form;
}

describe("authenticated integration actions", () => {
  it("cannot write names for a user supplied by the browser", async () => {
    const form = new FormData();
    form.set("names", "דנה");
    form.set("user_id", "another-owner");
    expect((await saveRecognitionNames(form)).ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "authenticated-owner", recognition_names: ["דנה"] }));
  });
  it("does not overwrite a connection when provider verification fails", async () => {
    mocks.verify.mockRejectedValue(new Error("provider-secret-error"));
    const result = await connectPayplus(keys());
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("provider-secret-error");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("stores only encrypted keys bound to the authenticated owner", async () => {
    const result = await connectPayplus(keys());
    expect(result.ok).toBe(true);
    const saved = mocks.upsert.mock.calls[0][0] as { user_id: string; encrypted_credentials: string };
    expect(saved.user_id).toBe("authenticated-owner");
    expect(saved.encrypted_credentials).not.toContain("example-secret");
    expect(JSON.parse(unseal(saved.encrypted_credentials, "authenticated-owner:payplus"))).toEqual({ apiKey: "example-key", secretKey: "example-secret" });
  });
  it("refuses connections before encryption is configured", async () => {
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "");
    expect((await connectPayplus(keys())).ok).toBe(false);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("reports storage failure instead of a false success", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "sensitive-internal-error" } });
    const result = await connectPayplus(keys());
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("sensitive-internal-error");
  });
  it("scopes disconnect reads and deletion to the authenticated owner and provider", async () => {
    const readEq = vi.fn();
    const deleteEq = vi.fn();
    const readQuery = { eq: readEq, maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    readEq.mockReturnValue(readQuery);
    deleteEq.mockReturnValueOnce({ eq: deleteEq }).mockResolvedValueOnce({ error: null });
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue(readQuery), delete: vi.fn().mockReturnValue({ eq: deleteEq }) });
    expect((await disconnectIntegration("payplus")).ok).toBe(true);
    expect(readEq.mock.calls).toEqual([["user_id", "authenticated-owner"], ["provider", "payplus"]]);
    expect(deleteEq.mock.calls).toEqual([["user_id", "authenticated-owner"], ["provider", "payplus"]]);
  });
});
