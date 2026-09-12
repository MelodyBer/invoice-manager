import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

export default function TransactionsPage(): React.JSX.Element {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">תנועות</h1>
        <Link href="/transactions/new">
          <Button>תנועה חדשה</Button>
        </Link>
      </div>
      <EmptyState title="רשימת התנועות תוצג כאן" description="מסך זה ייבנה בשלב הבא." />
    </div>
  );
}
