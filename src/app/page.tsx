function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function Home(): React.JSX.Element {
  const today = formatDateDDMMYYYY(new Date());

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold text-primary">מערכת חשבוניות</h1>
      <p className="text-lg text-foreground/80">תאריך היום: {today}</p>
      <div className="flex gap-4 mt-4 text-sm">
        <span className="px-3 py-1 rounded border border-border text-income">
          הכנסה
        </span>
        <span className="px-3 py-1 rounded border border-border text-expense">
          הוצאה
        </span>
      </div>
    </main>
  );
}
