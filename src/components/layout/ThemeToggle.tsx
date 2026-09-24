"use client";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./nav-icons";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to the OS preference.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggle(): void {
    const next: Theme = (theme ?? readTheme()) === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Preference just won't persist across visits; the toggle itself still works this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "מעבר לתצוגה בהירה" : "מעבר לתצוגה כהה"}
      className="rounded-lg p-2 text-foreground/70 transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
