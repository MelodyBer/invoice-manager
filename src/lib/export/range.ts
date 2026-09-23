import { getCurrentPeriod } from "@/lib/calc";
import { first, todayIsrael, validDate, type SearchValues } from "@/lib/transactions/reporting";
import { formatDateDDMMYYYY } from "@/lib/format";
import type { ReportingFrequency } from "@/types/db";

export type ExportPreset = "day" | "week" | "month" | "period" | "year" | "custom";
export interface ExportRange {
  start: string;
  end: string;
  preset: ExportPreset;
  label: string;
}

const PRESETS: readonly ExportPreset[] = ["day", "week", "month", "period", "year", "custom"];

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Presets mirror /transactions but add day/week for the export screen's finer-grained ranges. */
export function resolveExportRange(params: SearchValues, frequency: ReportingFrequency, today: string = todayIsrael()): ExportRange {
  const rawPreset = first(params.preset) || "period";
  const preset = (PRESETS as readonly string[]).includes(rawPreset) ? (rawPreset as ExportPreset) : "period";
  const anchor = validDate(first(params.date)) ? first(params.date) : today;

  if (preset === "day") return { start: anchor, end: anchor, preset, label: `יום ${formatDateDDMMYYYY(anchor)}` };

  if (preset === "week") {
    const weekday = new Date(`${anchor}T12:00:00Z`).getUTCDay();
    const start = shiftDate(anchor, -weekday);
    const end = shiftDate(start, 6);
    return { start, end, preset, label: `שבוע ${formatDateDDMMYYYY(start)}–${formatDateDDMMYYYY(end)}` };
  }

  if (preset === "month") {
    const month = /^\d{4}-\d{2}$/.test(first(params.month)) ? first(params.month) : anchor.slice(0, 7);
    const period = getCurrentPeriod(`${month}-01`, "monthly");
    return { start: period.start, end: period.end, preset, label: period.name };
  }

  if (preset === "year") {
    const year = /^\d{4}$/.test(first(params.year)) ? first(params.year) : anchor.slice(0, 4);
    return { start: `${year}-01-01`, end: `${year}-12-31`, preset, label: `שנת ${year}` };
  }

  if (preset === "custom") {
    const start = first(params.start);
    const end = first(params.end);
    if (!validDate(start) || !validDate(end) || start > end) throw new Error("יש לבחור טווח תאריכים תקין, מהתאריך המוקדם למאוחר.");
    return { start, end, preset, label: `${formatDateDDMMYYYY(start)}–${formatDateDDMMYYYY(end)}` };
  }

  const period = getCurrentPeriod(anchor, frequency);
  return { start: period.start, end: period.end, preset: "period", label: period.name };
}
