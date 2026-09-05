import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
