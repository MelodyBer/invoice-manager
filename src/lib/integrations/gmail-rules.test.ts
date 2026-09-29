import { describe, expect, it } from "vitest";
import { attachments, dateRange, israelReceivedDate, matchRecipient, verifyFile, MAX_ATTACHMENT_BYTES } from "./gmail-rules";

describe("recipient matching without personal presets", () => {
  it("accepts explicit full names and configured spellings", () => {
    expect(matchRecipient(" DANA  COHEN ", 0.99, ["דנה כהן", "Dana Cohen"])).toBe("match");
    expect(matchRecipient("דָּנָה כהן", 1, ["דנה כהן"])).toBe("match");
  });
  it("allows a chosen first name on its own or as a separate word", () => {
    expect(matchRecipient("דנה", 0.99, ["דנה"])).toBe("match");
    expect(matchRecipient("Dana Cohen", 1, ["Dana"])).toBe("match");
  });
  it("does not accept a substring or unrelated person", () => {
    expect(matchRecipient("Jordan", 1, ["Dan"])).toBe("ignore");
    expect(matchRecipient("שרה לוי", 1, ["דנה כהן"])).toBe("ignore");
  });
  it("requires review for conflicting surnames when a full name was configured", () => {
    expect(matchRecipient("Dana Levi", 1, ["Dana", "Dana Cohen"])).toBe("review");
    expect(matchRecipient("Dana Cohen", 1, ["Dana", "Dana Cohen"])).toBe("match");
  });
  it("never automatically imports approximate or low-confidence matches", () => {
    expect(matchRecipient("Danna Cohen", 1, ["Dana Cohen"])).toBe("review");
    expect(matchRecipient("Dana", 0.79, ["Dana"])).toBe("review");
    expect(matchRecipient(null, 0, ["Dana"])).toBe("review");
    expect(matchRecipient("Dana", 1, [])).toBe("ignore");
  });
});
describe("mail dates", () => {
  it("validates real dates, order and maximum range", () => {
    expect(() => dateRange("2026-02-30", "2026-03-01")).toThrow();
    expect(() => dateRange("2026-04-02", "2026-04-01")).toThrow();
    expect(() => dateRange("2020-01-01", "2026-01-01")).toThrow();
    expect(dateRange("2026-04-01", "2026-04-01").query).toContain("after:");
  });
  it("uses Israel's actual day boundary in summer and winter", () => {
    expect(israelReceivedDate(String(Date.parse("2026-06-01T21:30:00Z")))).toBe("2026-06-02");
    expect(israelReceivedDate(String(Date.parse("2026-01-01T21:30:00Z")))).toBe("2026-01-01");
  });
});
describe("attachments", () => {
  it("finds nested external and inline attachment bodies", () => {
    const list = attachments({ parts: [{ parts: [{ partId: "0.1", filename: "invoice.pdf", mimeType: "application/pdf", body: { size: 10, attachmentId: "remote" } }] }, { partId: "1", filename: "scan.png", mimeType: "image/png", body: { size: 8, data: "inline" } }] });
    expect(list.map((part) => part.partId)).toEqual(["0.1", "1"]);
    expect(list[0].attachmentId).toBe("remote");
    expect(list[1].data).toBe("inline");
  });
  it("skips unsupported, unnamed, empty and oversized files", () => {
    expect(attachments({ parts: [
      { partId: "1", filename: "file.exe", mimeType: "application/octet-stream", body: { size: 5 } },
      { partId: "2", filename: "large.pdf", mimeType: "application/pdf", body: { size: MAX_ATTACHMENT_BYTES + 1 } },
      { partId: "3", filename: "empty.pdf", mimeType: "application/pdf", body: { size: 0 } },
    ] })).toEqual([]);
  });
  it("rejects renamed HTML and accepts actual supported signatures", () => {
    expect(() => verifyFile(Buffer.from("<html>bad</html>"), "application/pdf")).toThrow();
    expect(() => verifyFile(Buffer.from("%PDF-1.7"), "application/pdf")).not.toThrow();
    expect(() => verifyFile(Buffer.from("89504e470d0a1a0a", "hex"), "image/png")).not.toThrow();
    expect(() => verifyFile(Buffer.from("ffd8ffe0", "hex"), "image/jpeg")).not.toThrow();
  });
});
