"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { submitPeriod } from "@/lib/export/period-actions";
import type { SearchValues } from "@/lib/transactions/reporting";

export function SubmitPeriodButton({ params }: { params: SearchValues }): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    startTransition(async () => {
      const result = await submitPeriod(params);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div role="alert" className="rounded border border-warning p-3">
        <p className="mb-2">לסמן את התקופה הזו כ״הוגשה״ לרו״ח? התנועות בתקופה יישארו ניתנות לעריכה, אך תופיע אזהרה בכל עריכה של תנועה בתוכה.</p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>ביטול</Button>
          <Button isLoading={pending} onClick={submit}>אישור והגשה</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p role="alert" className="mb-2 text-expense">{error}</p>}
      <Button variant="secondary" onClick={() => setConfirming(true)}>סימון התקופה כהוגשה</Button>
    </div>
  );
}
