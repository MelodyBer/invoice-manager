import Link from "next/link";
import { userContext } from "@/lib/transactions/load-range";
import { importList } from "@/lib/integrations/gmail-import";
import { GmailImport } from "./GmailImport";
export const maxDuration = 240;
export default async function GmailImportPage(): Promise<React.JSX.Element> {
  const { supabase, userId } = await userContext();
  const [connection, settings] = await Promise.all([
    supabase.from("integration_connections").select("account_label").eq("user_id", userId).eq("provider", "gmail").maybeSingle(),
    supabase.from("integration_settings").select("recognition_names").eq("user_id", userId).maybeSingle(),
  ]);
  if (connection.error || settings.error) return <p role="alert">לא ניתן לטעון את הגדרות החיבור. נסי לרענן.</p>;
  if (!connection.data || !settings.data?.recognition_names.length) return <div className="space-y-4"><h1 className="text-2xl font-bold">ייבוא מ־Gmail</h1><p>כדי להתחיל, חברי Gmail ושמרי לפחות שם אחד לזיהוי.</p><Link href="/settings/integrations" className="text-primary underline">לחיבורים ולהגדרות הזיהוי</Link></div>;
  try {
    const list = await importList(supabase, userId);
    return <GmailImport mailbox={connection.data.account_label} names={settings.data.recognition_names} initial={list.rows} initialMore={list.more} />;
  } catch { return <div className="space-y-3"><h1 className="text-2xl font-bold">ייבוא מ־Gmail</h1><p role="alert">נדרשת הכנה חד־פעמית של תור הייבוא במסד הנתונים לפני התחלת החיפוש.</p><Link href="/settings/integrations" className="text-primary underline">חזרה לחיבורים</Link></div>; }
}
