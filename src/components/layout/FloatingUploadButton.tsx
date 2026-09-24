"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Quick access to the camera from anywhere on mobile; hidden where it would collide with the page's own
 * bottom action bar (/upload already has this action, and the review screen has its own sticky save buttons). */
export function FloatingUploadButton(): React.JSX.Element | null {
  const pathname = usePathname();
  if (pathname === "/upload" || /^\/documents\/[^/]+\/review$/.test(pathname)) return null;

  return (
    <Link
      href="/upload?mode=camera"
      aria-label="צילום חשבונית מהיר"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
      className="fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg transition-transform hover:scale-105 md:hidden print:hidden"
    >
      <span aria-hidden="true">📷</span>
    </Link>
  );
}
