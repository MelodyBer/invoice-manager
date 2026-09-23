"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, HebrewDatePicker, Select } from "@/components/ui";
import type { DashboardWindow } from "@/lib/calc";
export function PeriodPicker({ window }: { window: DashboardWindow }): React.JSX.Element {
    const router = useRouter();
    const [preset, setPreset] = useState<string>(window.preset);
    const [start, setStart] = useState(window.selected.start);
    const [end, setEnd] = useState(window.selected.end);
    const [pending, startTransition] = useTransition();
    return <form onSubmit={event => { event.preventDefault(); startTransition(() => router.push(`/dashboard?${new URLSearchParams({ preset, start, end })}`)); }} className="grid min-w-0 gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end" aria-label="בחירת תקופה לדשבורד">
        <Select id="dashboard-period" label="התקופה להצגה" value={preset} onChange={event => setPreset(event.target.value)} options={[{ value: "period", label: "התקופה הנוכחית לדיווח" }, { value: "month", label: "החודש הזה" }, { value: "year", label: "השנה הזו" }, { value: "custom", label: "טווח מותאם" }]} />
        {preset === "custom" && <><HebrewDatePicker id="dashboard-start" label="מתאריך" value={start} onChange={setStart} /><HebrewDatePicker id="dashboard-end" label="עד תאריך" value={end} onChange={setEnd} /></>}
        <Button isLoading={pending} type="submit">הצג תקופה</Button>
        {pending && <p role="status" className="text-sm">מעדכנת את הנתונים…</p>}
    </form>;
}
