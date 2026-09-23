export const HEBREW_MONTH_NAMES: readonly string[] = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function getHebrewMonthName(monthIndex: number): string {
  return HEBREW_MONTH_NAMES[monthIndex] ?? "";
}

export function formatDateDDMMYYYY(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(parsedDate.getTime())) return "תאריך לא תקין";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsedDate);
}

const numberFormatter = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrencyILS(amount: number): string {
  return `₪${numberFormatter.format(amount)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(0)} KB`;
  }
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

/** Formats integer agorot returned by calc.ts. */
export function formatCentsILS(cents: number): string {
 if (!Number.isSafeInteger(cents)) throw new Error("סכום באגורות חייב להיות שלם.");
 return formatCurrencyILS(cents / 100);
}
