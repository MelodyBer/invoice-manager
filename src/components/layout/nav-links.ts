export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "דשבורד" },
  { href: "/upload", label: "העלאת מסמך" },
  { href: "/documents", label: "מסמכים לאישור" },
  { href: "/transactions", label: "תנועות" },
  { href: "/calendar", label: "תאריכון" },
  { href: "/export", label: "ייצוא לרו״ח" },
  { href: "/settings", label: "הגדרות" },
];
