"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, HebrewDatePicker, Select } from "@/components/ui";

const PRESET_OPTIONS = [
  { value: "day", label: "יומי" },
  { value: "week", label: "שבועי" },
  { value: "month", label: "חודשי" },
  { value: "period", label: "התקופה הנוכחית לדיווח" },
  { value: "year", label: "שנתי" },
  { value: "custom", label: "טווח מותאם" },
];

export interface ExportFilterValues {
  preset: string;
  date: string;
  start: string;
  end: string;
  year: string;
}

const EARLIEST_YEAR = 2020;

function yearOptions(currentYear: number): { value: string; label: string }[] {
  const years: number[] = [];
  for (let year = currentYear; year >= EARLIEST_YEAR; year--) years.push(year);
  return years.map(year => ({ value: String(year), label: String(year) }));
}

export function ExportFilters({ initial, currentYear }: { initial: ExportFilterValues; currentYear: number }): React.JSX.Element {
  const [values, setValues] = useState(initial);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = values.preset === "custom"
      ? new URLSearchParams({ preset: values.preset, start: values.start, end: values.end })
      : values.preset === "year"
        ? new URLSearchParams({ preset: values.preset, year: values.year })
        : new URLSearchParams({ preset: values.preset, date: values.date });
    startTransition(() => router.push(`/export?${params}`));
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end" aria-label="בחירת טווח לייצוא">
      <Select id="export-preset" label="טווח הייצוא" value={values.preset} onChange={event => setValues({ ...values, preset: event.target.value })} options={PRESET_OPTIONS} />
      {values.preset === "custom" ? (
        <>
          <HebrewDatePicker id="export-start" label="מתאריך" value={values.start} onChange={start => setValues({ ...values, start })} />
          <HebrewDatePicker id="export-end" label="עד תאריך" value={values.end} onChange={end => setValues({ ...values, end })} />
        </>
      ) : values.preset === "year" ? (
        <Select id="export-year" label="שנה" value={values.year} onChange={event => setValues({ ...values, year: event.target.value })} options={yearOptions(currentYear)} />
      ) : (
        <HebrewDatePicker id="export-date" label="תאריך בתוך הטווח" value={values.date} onChange={date => setValues({ ...values, date })} />
      )}
      <Button type="submit" isLoading={pending}>הצג תוצאות</Button>
    </form>
  );
}
