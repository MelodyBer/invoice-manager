"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

function triggerDownload(blob: Blob, fallbackName: string, contentDisposition: string | null): void {
  const match = contentDisposition ? /filename\*=UTF-8''([^;]+)/.exec(contentDisposition) : null;
  const fileName = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type DownloadKey = "excel" | "zip" | "bundle";

export function ExportButtons({ query, hasRows, hasDocuments }: { query: string; hasRows: boolean; hasDocuments: boolean }): React.JSX.Element {
  const [busy, setBusy] = useState<DownloadKey | null>(null);
  const [error, setError] = useState("");

  async function download(path: string, key: DownloadKey, fallbackName: string): Promise<void> {
    setBusy(key);
    setError("");
    try {
      const response = await fetch(`${path}?${query}`);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "הייצוא נכשל. נסי שוב.";
        throw new Error(message);
      }
      triggerDownload(await response.blob(), fallbackName, response.headers.get("Content-Disposition"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייצוא נכשל. נסי שוב.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-expense">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button isLoading={busy === "excel"} disabled={!hasRows || (busy !== null && busy !== "excel")} onClick={() => void download("/api/export/excel", "excel", "export.xlsx")}>
          ייצוא לאקסל
        </Button>
        <a
          href={hasRows ? `/export/report?${query}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!hasRows}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 ${!hasRows ? "pointer-events-none opacity-50" : ""}`}
        >
          דוח להדפסה / PDF
        </a>
        <Button variant="secondary" isLoading={busy === "zip"} disabled={!hasDocuments || (busy !== null && busy !== "zip")} onClick={() => void download("/api/export/zip", "zip", "documents.zip")}>
          ייצוא מסמכים (ZIP)
        </Button>
        <Button variant="secondary" isLoading={busy === "bundle"} disabled={!hasRows || (busy !== null && busy !== "bundle")} onClick={() => void download("/api/export/bundle", "bundle", "export.zip")}>
          ייצא הכל (ZIP)
        </Button>
      </div>
      {busy && <p role="status" className="text-sm text-foreground/70">יוצרת את הקובץ… זה עשוי לקחת כמה שניות.</p>}
    </div>
  );
}
