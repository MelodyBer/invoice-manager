import { userContext } from "@/lib/transactions/load-range";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { supabase, userId } = await userContext();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", userId)
    .single();

  return <AppShell businessName={profile?.business_name ?? null}>{children}</AppShell>;
}
