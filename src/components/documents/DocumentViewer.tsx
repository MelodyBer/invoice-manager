"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui";

interface DocumentViewerProps {
  storagePath: string;
  mimeType: string;
}

const SIGNED_URL_EXPIRY_SECONDS = 3600;
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export function DocumentViewer({ storagePath, mimeType }: DocumentViewerProps): React.JSX.Element {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    async function load(): Promise<void> {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || storagePath.split("/")[0] !== auth.user.id) {
        if (isMounted) setErrorMessage("אין הרשאה לצפות במסמך.");
        return;
      }
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
      if (isMounted) {
        if (error) setErrorMessage("לא ניתן להציג את המסמך. נסי לרענן את הדף.");
        else setSignedUrl(data?.signedUrl ?? null);
      }
    }
    void load().catch(() => { if (isMounted) setErrorMessage("לא ניתן לטעון את המסמך. בדקי את החיבור לרשת."); });
    return () => {
      isMounted = false;
    };
  }, [storagePath]);

  if (errorMessage) return <p role="alert">{errorMessage}</p>;

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} />
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <div className="relative isolate min-w-0 overflow-hidden rounded-lg border border-border">
        <iframe
          src={signedUrl}
          title="תצוגת המסמך המקורי"
          className="block w-full border-0"
          style={{ height: "clamp(320px, 65vh, 600px)" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
          aria-label="הגדלה"
          className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
          aria-label="הקטנה"
          className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setRotation((current) => current - 90)}
          aria-label="סיבוב שמאלה"
          className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={() => setRotation((current) => current + 90)}
          aria-label="סיבוב ימינה"
          className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5"
        >
          ↻
        </button>
      </div>
      <div
        className="overflow-auto rounded-lg border border-border bg-foreground/5 p-2"
        style={{ maxHeight: 600 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt="המסמך המקורי"
          className="mx-auto"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center",
            transition: "transform 0.2s",
          }}
        />
      </div>
    </div>
  );
}
