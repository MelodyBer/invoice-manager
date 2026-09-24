"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BottomNavLink {
  href: string;
  label: string;
  icon: string;
}

const BOTTOM_NAV_LINKS: readonly BottomNavLink[] = [
  { href: "/dashboard", label: "דשבורד", icon: "🏠" },
  { href: "/upload", label: "העלאה", icon: "📷" },
  { href: "/transactions", label: "תנועות", icon: "📋" },
  { href: "/calendar", label: "תאריכון", icon: "📅" },
];

export function MobileBottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden print:hidden"
    >
      {BOTTOM_NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive ? "text-primary" : "text-foreground/60"
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
