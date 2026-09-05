"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCameraAvailable } from "@/lib/upload/use-camera-available";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

const ACCEPTED_INPUT_TYPES = "image/jpeg,image/png,image/heic,application/pdf";

export function DropZone({ onFilesSelected }: DropZoneProps): React.JSX.Element {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isCameraAvailable = useCameraAvailable();

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return;
      }
      onFilesSelected(Array.from(fileList));
    },
    [onFilesSelected]
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent): void {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }
      if (pastedFiles.length > 0) {
        onFilesSelected(pastedFiles);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onFilesSelected]);

  function handleZoneKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleZoneKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
          isDraggingOver ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <p className="text-sm font-medium text-foreground">גררי קבצים לכאן או לחצי לבחירה</p>
        <p className="text-xs text-foreground/60">
          JPG, PNG, HEIC או PDF, עד 10MB לקובץ. אפשר גם להדביק (Ctrl+V) צילום מסך.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_INPUT_TYPES}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
        className="sr-only"
        aria-label="בחירת קבצים להעלאה"
      />

      {isCameraAvailable ? (
        <>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="self-start rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            צלמי מסמך
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
            className="sr-only"
            aria-label="צילום מסמך במצלמה"
          />
        </>
      ) : null}
    </div>
  );
}
