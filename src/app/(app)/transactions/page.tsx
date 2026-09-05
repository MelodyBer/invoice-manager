import { EmptyState } from "@/components/ui";

export default function TransactionsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">תנועות</h1>
      <EmptyState title="רשימת התנועות תוצג כאן" description="מסך זה ייבנה בשלב הבא." />
    </div>
  );
}
