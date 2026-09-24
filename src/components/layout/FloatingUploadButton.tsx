"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CameraIcon } from "./nav-icons";
import { Button, Dialog } from "@/components/ui";
import { setPendingCapture } from "@/lib/upload/pending-capture";

const CAMERA_BOTTOM_OFFSET = { bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" };

/** Quick access to adding a document from anywhere on mobile; hidden where it would collide with the
 * page's own bottom action bar (/upload already has this action, and the review screen has its own
 * sticky save buttons). Tapping the button opens a choice (camera or file) instead of jumping straight
 * into the camera — a native camera view is a full-screen OS surface with nothing of the page visible
 * behind it, so a fallback message can only show before or after it, never over it. Each choice then
 * clicks its hidden input directly from that same tap, which real devices require for the native
 * picker to open at all — a click fired later from a useEffect after navigating no longer counts. */
export function FloatingUploadButton(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isChoiceOpen, setIsChoiceOpen] = useState(false);

  if (pathname === "/upload" || /^\/documents\/[^/]+\/review$/.test(pathname)) return null;

  function handleCaptured(files: FileList | null): void {
    if (!files || files.length === 0) return;
    setPendingCapture(Array.from(files));
    setIsChoiceOpen(false);
    router.push("/upload");
  }

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => handleCaptured(event.target.files)}
        className="sr-only"
        aria-label="צילום חשבונית"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,application/pdf"
        multiple
        onChange={(event) => handleCaptured(event.target.files)}
        className="sr-only"
        aria-label="בחירת קובץ להעלאה"
      />

      <button
        type="button"
        onClick={() => setIsChoiceOpen(true)}
        aria-label="הוספת מסמך"
        style={CAMERA_BOTTOM_OFFSET}
        className="fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 md:hidden print:hidden"
      >
        <CameraIcon className="h-7 w-7" />
      </button>

      <Dialog isOpen={isChoiceOpen} onClose={() => setIsChoiceOpen(false)} title="הוספת מסמך">
        <div className="flex flex-col gap-3">
          <Button onClick={() => cameraInputRef.current?.click()}>צילום מסמך</Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            בחירת קובץ מהמכשיר
          </Button>
        </div>
      </Dialog>
    </>
  );
}
