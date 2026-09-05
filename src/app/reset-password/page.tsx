"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/validators";
import { Button, Input } from "@/components/ui";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

type ResetPasswordMode = "request" | "update";

export default function ResetPasswordPage(): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<ResetPasswordMode>("request");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!isValidEmail(email)) {
      setFormError("כתובת האימייל אינה תקינה");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);

    setInfoMessage("אם קיים חשבון עם כתובת אימייל זו, נשלח אליו קישור לאיפוס הסיסמה.");
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    if (!isValidPassword(newPassword)) {
      setFormError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("הסיסמאות אינן תואמות");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (mode === "update") {
    return (
      <AuthPageShell>
        <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">קביעת סיסמה חדשה</h2>

          <Input
            id="new-password"
            label="סיסמה חדשה"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <Input
            id="confirm-new-password"
            label="אימות סיסמה חדשה"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />

          {formError ? <p className="text-sm text-expense">{formError}</p> : null}

          <Button type="submit" isLoading={isSubmitting}>
            עדכון סיסמה
          </Button>
        </form>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">איפוס סיסמה</h2>
        <p className="text-sm text-foreground/70">
          הזיני את כתובת האימייל שלך ונשלח אליך קישור לאיפוס הסיסמה.
        </p>

        <Input
          id="email"
          label="אימייל"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        {formError ? <p className="text-sm text-expense">{formError}</p> : null}
        {infoMessage ? <p className="text-sm text-income">{infoMessage}</p> : null}

        <Button type="submit" isLoading={isSubmitting}>
          שליחת קישור לאיפוס
        </Button>

        <p className="text-center text-sm text-foreground/70">
          <Link href="/login" className="hover:underline">
            חזרה להתחברות
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
