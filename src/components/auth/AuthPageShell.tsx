import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function AuthPageShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-primary">מערכת חשבוניות</h1>
        <Card>{children}</Card>
      </div>
    </div>
  );
}
