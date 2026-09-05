import type { AuthError } from "@supabase/supabase-js";

export function getAuthErrorMessage(error: AuthError | null): string {
  if (!error) {
    return "אירעה שגיאה. נסי שוב.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "אימייל או סיסמה שגויים";
  }
  if (message.includes("user already registered")) {
    return "משתמש עם אימייל זה כבר קיים";
  }
  if (message.includes("password should be at least")) {
    return "הסיסמה קצרה מדי (נדרשים לפחות 6 תווים)";
  }
  if (
    message.includes("unable to validate email address") ||
    message.includes("invalid email")
  ) {
    return "כתובת האימייל אינה תקינה";
  }
  if (message.includes("email not confirmed")) {
    return "יש לאשר את כתובת האימייל לפני ההתחברות. בדקי את תיבת הדואר שלך";
  }
  if (message.includes("rate limit")) {
    return "יותר מדי ניסיונות. נסי שוב בעוד כמה דקות";
  }

  return "אירעה שגיאה. נסי שוב.";
}
