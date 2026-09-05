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
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
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
