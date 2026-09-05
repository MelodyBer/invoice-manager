import { formatFileSize } from "@/lib/format";
import { isPreviewableImage, resolveMimeType } from "@/lib/upload/validation";
import type { UploadFileItem, UploadFileStatus } from "@/types/upload";

interface FileListItemProps {
  item: UploadFileItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const STATUS_LABELS: Record<UploadFileStatus, string> = {
  pending: "ממתינה",
  compressing: "מכווצת...",
  uploading: "מעלה...",
  success: "הועלתה בהצלחה",
  error: "שגיאה",
};

export function FileListItem({ item, onRemove, onRetry }: FileListItemProps): React.JSX.Element {
  const canPreview = isPreviewableImage(resolveMimeType(item.file));

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
        <p className="text-xs text-foreground/60">
          {formatFileSize(item.file.size)} · {STATUS_LABELS[item.status]}
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`h-full rounded-full transition-all ${
              item.status === "error" ? "bg-expense" : "bg-primary"
            } ${item.status === "uploading" ? "animate-pulse" : ""}`}
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
        {item.status === "error" && item.errorMessage ? (
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
