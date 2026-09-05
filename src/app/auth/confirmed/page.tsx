"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button, Spinner } from "@/components/ui";

type ConfirmationStatus = "checking" | "success" | "error";

const VERIFICATION_TIMEOUT_MS = 6000;

export default function AuthConfirmedPage(): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmationStatus>("checking");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("success");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setStatus("success");
      }
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "error" : current));
    }, VERIFICATION_TIMEOUT_MS);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (status === "checking") {
    return (
      <AuthPageShell>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Spinner size={32} />
          <p className="text-sm text-foreground/70">מאמתת את החשבון שלך...</p>
        </div>
      </AuthPageShell>
    );
  }

  if (status === "error") {
    return (
      <AuthPageShell>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <h2 className="text-lg font-semibold text-foreground">האימות נכשל</h2>
          <p className="text-sm text-foreground/70">
            ייתכן שהקישור פג תוקף או שכבר נעשה בו שימוש. נסי להתחבר עם האימייל והסיסמה שלך.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => router.push("/login")}>
            חזרה להתחברות
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <h2 className="text-lg font-semibold text-income">התחברת בהצלחה!</h2>
        <p className="text-sm text-foreground/70">החשבון שלך אומת ואת מחוברת למערכת.</p>
        <Button className="w-full" onClick={() => router.push("/dashboard")}>
          כניסה למערכת
        </Button>
      </div>
    </AuthPageShell>
  );
}
