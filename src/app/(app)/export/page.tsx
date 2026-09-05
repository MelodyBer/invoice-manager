import { EmptyState } from "@/components/ui";

export default function ExportPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">ייצוא לרו״ח</h1>
      <EmptyState
        title="מסך הייצוא ייבנה בשלב הבא"
        description="כאן יתאפשר להפיק מסמכים מרוכזים לרואה החשבון."
      />
    </div>
  );
}
