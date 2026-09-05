"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { isValidEmail } from "@/lib/validators";
import { Button, Input } from "@/components/ui";

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    if (!isValidEmail(email)) {
      setFormError("כתובת האימייל אינה תקינה");
      return;
    }
    if (password.length === 0) {
      setFormError("יש להזין סיסמה");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">התחברות</h2>

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
        autoComplete="current-password"
        required
      />

      {formError ? <p className="text-sm text-expense">{formError}</p> : null}

      <Button type="submit" isLoading={isSubmitting}>
        התחברות
      </Button>

      <div className="flex items-center justify-between text-sm text-foreground/70">
        <Link href="/reset-password" className="hover:underline">
          שכחתי סיסמה
        </Link>
        <Link href="/signup" className="hover:underline">
          אין לך חשבון? הרשמה
        </Link>
      </div>
    </form>
  );
}
