import { EmptyState } from "@/components/ui";

export default function DashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">דשבורד</h1>
      <EmptyState
        title="עדיין אין נתונים להצגה"
        description="לאחר שתעלי מסמכים ראשונים, כאן יוצג מצב העסק שלך."
      />
    </div>
  );
}
