import { EmptyState } from "@/components/ui";

export default function UploadPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">העלאת מסמך</h1>
      <EmptyState
        title="מסך העלאת המסמכים ייבנה בשלב הבא"
        description="כאן יתאפשר לצלם או להעלות חשבוניות וקבלות."
      />
    </div>
  );
}
