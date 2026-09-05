"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/validators";
import { Button, Input } from "@/components/ui";

export default function SignupPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!isValidEmail(email)) {
      setFormError("כתובת האימייל אינה תקינה");
      return;
    }
    if (!isValidPassword(password)) {
      setFormError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("הסיסמאות אינן תואמות");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
      },
    });
    setIsSubmitting(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setInfoMessage("נשלח אליך מייל לאישור ההרשמה. יש לאשר את הכתובת כדי להתחבר.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">הרשמה</h2>

      <Input
        id="email"
        label="אימייל"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />
      <Input
        id="password"
        label="סיסמה"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        required
      />
      <Input
        id="confirm-password"
        label="אימות סיסמה"
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        required
      />

      {formError ? <p className="text-sm text-expense">{formError}</p> : null}
      {infoMessage ? <p className="text-sm text-income">{infoMessage}</p> : null}

      <Button type="submit" isLoading={isSubmitting}>
        הרשמה
      </Button>

      <p className="text-center text-sm text-foreground/70">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="hover:underline">
          התחברות
        </Link>
      </p>
    </form>
  );
}
