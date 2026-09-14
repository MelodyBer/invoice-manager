"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, HebrewDatePicker } from "@/components/ui";
import type { CategoryRow } from "@/types/db";
export function TransactionFilters({ initial, categories }: { initial: { preset: string; start: string; end: string; direction: string; category: string; q: string }; categories: CategoryRow[] }): React.JSX.Element {
  const [values, setValues] = useState(initial); const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>): void { event.preventDefault(); const params = new URLSearchParams(values); startTransition(() => router.push(`/transactions?${params}`)); }
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
    <Select id="range-preset" label="טווח תאריכים" value={values.preset} onChange={event => setValues({ ...values, preset: event.target.value })} options={[{ value: "month", label: "החודש" }, { value: "previous", label: "החודש שעבר" }, { value: "period", label: "התקופה הנוכחית לדיווח" }, { value: "year", label: "השנה" }, { value: "custom", label: "טווח מותאם" }]} />
    <Select id="filter-direction" label="סוג תנועה" value={values.direction} onChange={event => setValues({ ...values, direction: event.target.value, category: "" })} options={[{ value: "", label: "הכל" }, { value: "income", label: "הכנסות" }, { value: "expense", label: "הוצאות" }]} />
    <Select id="filter-category" label="קטגוריה" value={values.category} onChange={event => setValues({ ...values, category: event.target.value })} options={[{ value: "", label: "כל הקטגוריות" }, ...categories.filter(category => !values.direction || category.direction === values.direction).map(category => ({ value: category.id, label: category.name }))]} />
    {values.preset === "custom" && <><HebrewDatePicker id="range-start" label="מתאריך" value={values.start} onChange={start => setValues({ ...values, start })} /><HebrewDatePicker id="range-end" label="עד תאריך" value={values.end} onChange={end => setValues({ ...values, end })} /></>}
    <Input id="transaction-search" label="חיפוש לפי שם או מספר מסמך" value={values.q} maxLength={150} onChange={event => setValues({ ...values, q: event.target.value })} />
    <div className="flex items-end gap-2"><Button type="submit" isLoading={pending}>הצג תוצאות</Button><Button variant="secondary" type="button" onClick={() => router.push("/transactions")}>ניקוי מסננים</Button></div>
  </form>;
}
