import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gmailGet, getFile } from "./gmail-api";
function reply(data: unknown, status: number = 200): Response { return new Response(JSON.stringify(data), { status }); }
afterEach(() => vi.unstubAllGlobals());
describe("Gmail read-only network requests", () => {
  it("retrieves nested attachment bytes without putting credentials in URLs", async () => {
    const bytes: Buffer = Buffer.from("%PDF-1.7");
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ payload: { parts: [{ partId: "0", filename: "bill.pdf", mimeType: "application/pdf", body: { size: bytes.length, attachmentId: "file/id" } }] } })).mockResolvedValueOnce(reply({ data: bytes.toString("base64url") }));
    vi.stubGlobal("fetch", fetcher);
    const result = await getFile("test-access-token", "mail/id", "0");
    expect(result.bytes).toEqual(bytes);
    expect(fetcher.mock.calls[1][0]).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/mail%2Fid/attachments/file%2Fid");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error", headers: { Authorization: "Bearer test-access-token" } });
  });
  it("supports a small file embedded directly in a MIME part", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ payload: { partId: "", filename: "bill.pdf", mimeType: "application/pdf", body: { size: 4, data: Buffer.from("test").toString("base64url") } } })));
    expect((await getFile("token", "mail", "")).bytes.toString()).toBe("test");
  });
  it("retries a transient network failure once", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(reply({ messages: [] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(gmailGet("token", "messages")).resolves.toEqual({ messages: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry an expired permission or leak provider responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ private: "secret-error" }, 401));
    vi.stubGlobal("fetch", fetcher);
    await expect(gmailGet("token", "messages")).rejects.toThrow("חברי מחדש");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects partial downloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ payload: { partId: "", filename: "bill.pdf", mimeType: "application/pdf", body: { size: 10, data: "dGVzdA" } } })));
    await expect(getFile("token", "mail", "")).rejects.toThrow("במלואו");
  });
});
