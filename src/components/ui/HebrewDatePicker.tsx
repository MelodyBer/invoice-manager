"use client";

import { useEffect, useRef, useState } from "react";
import { HEBREW_MONTH_NAMES } from "@/lib/format";

interface HebrewDatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  warning?: string;
}

const WEEKDAY_LETTERS: readonly string[] = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateValue(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseDateValue(value: string): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1, day: Number(match[3]) };
}

function formatDisplayValue(value: string): string {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "";
  }
  return `${pad2(parsed.day)}/${pad2(parsed.monthIndex + 1)}/${parsed.year}`;
}

export function HebrewDatePicker({
  id,
  label,
  value,
  onChange,
  warning,
}: HebrewDatePickerProps): React.JSX.Element {
  const today = new Date();
  const selected = parseDateValue(value);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.monthIndex ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openPicker(): void {
    const current = parseDateValue(value);
    setViewYear(current?.year ?? today.getFullYear());
    setViewMonth(current?.monthIndex ?? today.getMonth());
    setIsOpen(true);
  }

  function goToPreviousMonth(): void {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return prev - 1;
    });
  }

  function goToNextMonth(): void {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return prev + 1;
    });
  }

  function handleSelectDay(day: number): void {
    onChange(toDateValue(viewYear, viewMonth, day));
    setIsOpen(false);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, index) => index);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  const isToday = (day: number): boolean =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  const isSelected = (day: number): boolean =>
    selected !== null &&
    selected.year === viewYear &&
    selected.monthIndex === viewMonth &&
    selected.day === day;

  return (
    <div className="relative flex flex-col gap-1" ref={containerRef}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <button
        type="button"
        id={id}
        onClick={openPicker}
        className={`rounded-lg border bg-background px-3 py-2 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
          warning ? "border-warning" : "border-border"
        }`}
      >
        {formatDisplayValue(value) || "בחרי תאריך"}
      </button>
      {warning ? <span className="text-xs text-warning">{warning}</span> : null}

      {isOpen ? (
        <div className="absolute top-full z-20 mt-1 w-72 rounded-lg border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousMonth}
              aria-label="חודש קודם"
              className="rounded-lg px-2 py-1 text-foreground hover:bg-foreground/5"
            >
              ›
            </button>
            <span className="text-sm font-medium text-foreground">
              {HEBREW_MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="חודש הבא"
              className="rounded-lg px-2 py-1 text-foreground hover:bg-foreground/5"
            >
              ‹
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground/60">
            {WEEKDAY_LETTERS.map((letter) => (
              <span key={letter} className="py-1">
                {letter}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {leadingBlanks.map((blank) => (
              <span key={`blank-${blank}`} />
            ))}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={`rounded-lg py-1.5 transition-colors hover:bg-foreground/10 ${
                  isSelected(day)
                    ? "bg-primary text-white"
                    : isToday(day)
                      ? "border border-primary text-foreground"
                      : "text-foreground"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
