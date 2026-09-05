"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, useToast } from "@/components/ui";
import { DirectionToggle } from "@/components/upload/DirectionToggle";
import { DropZone } from "@/components/upload/DropZone";
import { FileListItem } from "@/components/upload/FileListItem";
import { validateFile, resolveMimeType, isPreviewableImage } from "@/lib/upload/validation";
import { compressImageIfNeeded } from "@/lib/upload/compress-image";
import { buildStoragePath, getExtensionFromMimeType } from "@/lib/upload/storage-path";
import type { Direction } from "@/types/db";
import type { UploadFileItem } from "@/types/upload";

export default function UploadPage(): React.JSX.Element {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  const [direction, setDirection] = useState<Direction>("expense");
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filesRef = useRef<UploadFileItem[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      const hasActiveUpload = files.some(
        (item) => item.status === "uploading" || item.status === "compressing"
      );
      if (hasActiveUpload) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [files]);

  const updateItem = useCallback((id: string, patch: Partial<UploadFileItem>) => {
    setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  function handleFilesSelected(newFiles: File[]): void {
    const validItems: UploadFileItem[] = [];

    for (const file of newFiles) {
      const validation = validateFile(file);
      if (!validation.isValid) {
        showToast(validation.errorMessage ?? "קובץ לא תקין", "error");
        continue;
      }

      const mimeType = resolveMimeType(file);
      validItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: isPreviewableImage(mimeType) ? URL.createObjectURL(file) : null,
        status: "pending",
        progressPercent: 0,
        errorMessage: null,
      });
    }

    if (validItems.length > 0) {
      setFiles((prev) => [...prev, ...validItems]);
    }
  }

  function handleRemove(id: string): void {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  const uploadSingleFile = useCallback(
    async (item: UploadFileItem, uploadUserId: string, uploadDirection: Direction): Promise<boolean> => {
      updateItem(item.id, { status: "compressing", progressPercent: 20, errorMessage: null });

      if (!navigator.onLine) {
        updateItem(item.id, {
          status: "error",
          errorMessage: "אין חיבור לאינטרנט. בדקי את החיבור ונסי שוב.",
        });
        return false;
      }

      let fileToUpload: File;
      try {
        fileToUpload = await compressImageIfNeeded(item.file);
      } catch {
        fileToUpload = item.file;
      }

      updateItem(item.id, { status: "uploading", progressPercent: 60 });

      const mimeType = fileToUpload.type || resolveMimeType(item.file);
      const extension = getExtensionFromMimeType(mimeType);
      const storagePath = buildStoragePath(uploadUserId, extension);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileToUpload, {
          contentType: mimeType || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        updateItem(item.id, {
          status: "error",
          errorMessage: navigator.onLine
            ? "העלאת הקובץ נכשלה. נסי שוב."
            : "אין חיבור לאינטרנט. בדקי את החיבור ונסי שוב.",
        });
        return false;
      }

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: uploadUserId,
        direction: uploadDirection,
        storage_path: storagePath,
        file_name: item.file.name,
        mime_type: mimeType || "application/octet-stream",
        file_size: fileToUpload.size,
        status: "pending",
      });

      if (insertError) {
        updateItem(item.id, {
          status: "error",
          errorMessage: "הקובץ הועלה אך שמירת הפרטים נכשלה. נסי שוב.",
        });
        return false;
      }

      updateItem(item.id, { status: "success", progressPercent: 100, errorMessage: null });
      return true;
    },
    [supabase, updateItem]
  );

  async function handleRetry(id: string): Promise<void> {
    if (!userId) {
      showToast("לא זוהה משתמש מחובר. נסי להתחבר מחדש.", "error");
      return;
    }
    const item = filesRef.current.find((current) => current.id === id);
    if (!item) {
      return;
    }
    await uploadSingleFile(item, userId, direction);
  }

  async function handleUploadAll(): Promise<void> {
    if (!userId) {
      showToast("לא זוהה משתמש מחובר. נסי להתחבר מחדש.", "error");
      return;
    }

    const itemsToUpload = files.filter((item) => item.status !== "success");
    if (itemsToUpload.length === 0) {
      return;
    }

    setIsUploading(true);
    const results = await Promise.all(
      itemsToUpload.map((item) => uploadSingleFile(item, userId, direction))
    );
    setIsUploading(false);

    if (results.every(Boolean)) {
      showToast("כל המסמכים הועלו בהצלחה");
      router.push("/documents");
    }
  }

  const hasFiles = files.length > 0;
  const pendingCount = files.filter((item) => item.status !== "success").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">העלאת מסמך</h1>

      <Card className="flex flex-col gap-6">
        <DirectionToggle value={direction} onChange={setDirection} />

        <DropZone onFilesSelected={handleFilesSelected} />

        {hasFiles ? (
          <ul className="flex flex-col gap-2">
            {files.map((item) => (
              <FileListItem key={item.id} item={item} onRemove={handleRemove} onRetry={handleRetry} />
            ))}
          </ul>
        ) : null}

        <Button
          type="button"
          onClick={() => void handleUploadAll()}
          isLoading={isUploading}
          disabled={!hasFiles || pendingCount === 0}
          className="self-start"
        >
          העלאה
        </Button>
      </Card>
    </div>
  );
}
