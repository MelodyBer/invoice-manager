"use client";
import { useEffect } from "react";

/** Minimal registration only: the service worker itself does not cache the app for offline use. */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
