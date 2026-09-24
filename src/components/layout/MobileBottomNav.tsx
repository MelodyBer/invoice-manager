"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, CameraIcon, HomeIcon, ListIcon } from "./nav-icons";

interface BottomNavLink {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
}

const BOTTOM_NAV_LINKS: readonly BottomNavLink[] = [
  { href: "/dashboard", label: "דשבורד", Icon: HomeIcon },
  { href: "/upload", label: "העלאה", Icon: CameraIcon },
  { href: "/transactions", label: "תנועות", Icon: ListIcon },
  { href: "/calendar", label: "תאריכון", Icon: CalendarIcon },
];

export function MobileBottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden print:hidden"
    >
      {BOTTOM_NAV_LINKS.map(({ href, label, Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive ? "text-primary" : "text-foreground/60"
            }`}
          >
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
