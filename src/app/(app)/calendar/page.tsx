import { EmptyState } from "@/components/ui";

export default function CalendarPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">תאריכון</h1>
      <EmptyState
        title="התאריכון ייבנה בשלב הבא"
        description="כאן יוצג לוח שנה עם המסמכים שהועלו בכל יום."
      />
    </div>
  );
}
