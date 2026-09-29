import { userContext } from "@/lib/transactions/load-range";
import { encryptionReady } from "@/lib/integrations/security";
import { googleReady } from "@/lib/integrations/providers";
import { ConnectionsForm } from "./ConnectionsForm";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connection?: string }> }): Promise<React.JSX.Element> {
  const { supabase, userId } = await userContext();
  const [settings, connections, query] = await Promise.all([
    supabase.from("integration_settings").select("recognition_names").eq("user_id", userId).maybeSingle(),
    supabase.from("integration_connections").select("provider, account_label").eq("user_id", userId),
    searchParams,
  ]);
  const databaseReady: boolean = !settings.error && !connections.error;
  const encrypted: boolean = encryptionReady();
  return <ConnectionsForm names={settings.data?.recognition_names ?? []} connections={connections.data ?? []} databaseReady={databaseReady} payplusReady={databaseReady && encrypted} gmailReady={databaseReady && encrypted && googleReady()} result={query.connection} />;
}
