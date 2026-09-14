"use client";
import { useRouter } from "next/navigation";
import { HEBREW_MONTH_NAMES } from "@/lib/format";
export function MonthSelector({ month }: { month: string }): React.JSX.Element {
  const router = useRouter(); const [year, number] = month.split("-").map(Number);
  function navigate(y: number, m: number): void { router.push(`/calendar?month=${y}-${String(m).padStart(2, "0")}`); }
  return <div className="flex flex-wrap justify-center gap-3"><label>חודש <select aria-label="חודש" className="rounded border border-border bg-background p-2" value={number} onChange={event => navigate(year, Number(event.target.value))}>{HEBREW_MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>שנה <select aria-label="שנה" className="rounded border border-border bg-background p-2" value={year} onChange={event => navigate(Number(event.target.value), number)}>{Array.from({ length: Math.max(new Date().getFullYear() + 5, year) - Math.min(2020, year) + 1 }, (_, index) => Math.min(2020, year) + index).map(y => <option key={y} value={y}>{y}</option>)}</select></label></div>;
}
