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
}

export function ExportFilters({ initial }: { initial: ExportFilterValues }): React.JSX.Element {
  const [values, setValues] = useState(initial);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = values.preset === "custom"
      ? new URLSearchParams({ preset: values.preset, start: values.start, end: values.end })
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
      ) : (
        <HebrewDatePicker id="export-date" label="תאריך בתוך הטווח" value={values.date} onChange={date => setValues({ ...values, date })} />
      )}
      <Button type="submit" isLoading={pending}>הצג תצוגה מקדימה</Button>
    </form>
  );
}
