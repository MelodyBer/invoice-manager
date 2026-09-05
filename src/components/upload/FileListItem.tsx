import { formatFileSize } from "@/lib/format";
import { isPreviewableImage, resolveMimeType } from "@/lib/upload/validation";
import { Spinner } from "@/components/ui";
import type { UploadFileItem, UploadFileStatus } from "@/types/upload";

interface FileListItemProps {
  item: UploadFileItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onRetryExtraction: (id: string) => void;
  onManualEntry: (id: string) => void;
}

const STATUS_LABELS: Record<UploadFileStatus, string> = {
  pending: "ממתינה",
  compressing: "מכווצת...",
  uploading: "מעלה...",
  extracting: "מזהה נתונים...",
  success: "הועלתה וזוהתה בהצלחה",
  error: "שגיאה בהעלאה",
  extraction_failed: "זיהוי הנתונים נכשל",
};

const IN_PROGRESS_STATUSES: readonly UploadFileStatus[] = ["compressing", "uploading", "extracting"];
const FAILED_STATUSES: readonly UploadFileStatus[] = ["error", "extraction_failed"];

export function FileListItem({
  item,
  onRemove,
  onRetry,
  onRetryExtraction,
  onManualEntry,
}: FileListItemProps): React.JSX.Element {
  const canPreview = isPreviewableImage(resolveMimeType(item.file));
  const isInProgress = IN_PROGRESS_STATUSES.includes(item.status);
  const isFailed = FAILED_STATUSES.includes(item.status);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-foreground/5">
        {canPreview && item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-foreground/50"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M14 3v5h5" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-foreground/60">
          {isInProgress ? <Spinner size={12} /> : null}
          {formatFileSize(item.file.size)} · {STATUS_LABELS[item.status]}
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`h-full rounded-full transition-all ${
              isFailed ? "bg-expense" : "bg-primary"
            } ${isInProgress ? "animate-pulse" : ""}`}
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
        {isFailed && item.errorMessage ? (
          <p className="mt-1 text-xs text-expense">{item.errorMessage}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.status === "error" ? (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            נסה שוב
          </button>
        ) : null}
        {item.status === "extraction_failed" ? (
          <>
            <button
              type="button"
              onClick={() => onRetryExtraction(item.id)}
              className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              נסה שוב
            </button>
            <button
              type="button"
              onClick={() => onManualEntry(item.id)}
              className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              הזן ידנית
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`הסרת ${item.file.name}`}
          className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-expense focus:outline-none focus:ring-2 focus:ring-primary"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
