import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <AuthPageShell>{children}</AuthPageShell>;
}
