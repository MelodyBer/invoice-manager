"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CameraIcon } from "./nav-icons";
import { setPendingCapture } from "@/lib/upload/pending-capture";

const CAMERA_BOTTOM_OFFSET = { bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" };

/** Quick access to the camera from anywhere on mobile; hidden where it would collide with the page's own
 * bottom action bar (/upload already has this action, and the review screen has its own sticky save buttons).
 * Opens the camera directly from a real click (required on iOS/Android — a click after navigating to a new
 * page no longer counts as a user gesture), then hands the photo to /upload once it's captured. */
export function FloatingUploadButton(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFallback, setShowFallback] = useState(false);

  if (pathname === "/upload" || /^\/documents\/[^/]+\/review$/.test(pathname)) return null;

  function handleCaptured(files: FileList | null): void {
    if (!files || files.length === 0) return;
    setPendingCapture(Array.from(files));
    setShowFallback(false);
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
        aria-label="צילום חשבונית מהיר"
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
        onClick={() => {
          setShowFallback(true);
          cameraInputRef.current?.click();
        }}
        aria-label="צילום חשבונית מהיר"
        style={CAMERA_BOTTOM_OFFSET}
        className="fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 md:hidden print:hidden"
      >
        <CameraIcon className="h-7 w-7" />
      </button>

      {showFallback && (
        <div
          role="status"
          style={CAMERA_BOTTOM_OFFSET}
          className="fixed inset-x-4 z-40 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 shadow-lg md:hidden"
        >
          <p className="text-sm">אפשר גם להעלות קובץ קיים מהטלפון</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5"
            >
              בחירת קובץ
            </button>
            <button
              type="button"
              onClick={() => setShowFallback(false)}
              aria-label="סגירת ההודעה"
              className="rounded-lg p-1.5 text-foreground/60 hover:bg-foreground/5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
