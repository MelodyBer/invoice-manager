import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./actions", () => ({ searchGmail: vi.fn(), checkGmailItem: vi.fn(), decideGmailItem: vi.fn(), showGmailItem: vi.fn(), refreshGmailItems: vi.fn() }));
import { GmailImport } from "./GmailImport";
import type { ImportView } from "@/types/gmail-import";
function render(rows: ImportView[]): string { return renderToStaticMarkup(<GmailImport mailbox="test@example.com" names={["דנה"]} initial={rows} initialMore={false} />); }
const row: ImportView = { id: "item", file_name: "very-long-original-invoice-name.pdf", received_on: "2026-09-29", state: "review", recipient_name: "דנה", reason: "נדרשת בדיקה", document_id: null };
describe("Gmail import presentation", () => {
  it("explains scope and starts only after date selection", () => {
    const html: string = render([]);
    expect(html).toContain("לפי תאריך קבלת המייל");
    expect(html).toContain("לא נוצרות תנועות מאושרות אוטומטית");
    expect(html).toContain("עדיין אין קבצים");
    expect(html).toContain("disabled");
  });
  it("provides an explicit ownership decision and bounds long filenames", () => {
    const html: string = render([row]);
    expect(html).toContain("truncate font-semibold");
    expect(html).toContain("המסמך שלי — העבר לאישור");
    expect(html).toContain("לא לייבא");
    expect(html).toContain("29/09/2026");
  });
  it("links completed imports to review without allowing a second import", () => {
    const html: string = render([{ ...row, state: "imported", document_id: "document" }]);
    expect(html).toContain("/documents/document/review");
    expect(html).not.toContain("המסמך שלי — העבר לאישור");
  });
});
