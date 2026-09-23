"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { NAV_LINKS } from "./nav-links";

interface AppShellProps {
  businessName: string | null;
  children: ReactNode;
}

export function AppShell({ businessName, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  async function handleLogout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function navLinkClassName(href: string): string {
    const isActive = pathname === href;
    return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-foreground/5"
    }`;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-e border-border bg-background md:flex md:flex-col print:hidden">
        <div className="p-4 text-lg font-bold text-primary">מערכת חשבוניות</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClassName(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-xl text-foreground md:hidden"
              aria-label="פתיחת תפריט"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              ☰
            </button>
            <span className="font-semibold text-foreground">{businessName ?? "העסק שלי"}</span>
          </div>
          <Button variant="ghost" onClick={() => void handleLogout()}>
            יציאה
          </Button>
        </header>

        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            aria-label="סגירת תפריט"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <nav className="relative z-50 flex w-64 flex-col gap-1 bg-background p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold text-primary">תפריט</span>
              <button
                type="button"
                className="rounded-lg p-2 text-xl text-foreground"
                aria-label="סגירת תפריט"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={navLinkClassName(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
