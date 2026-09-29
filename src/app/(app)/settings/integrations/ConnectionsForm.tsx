"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { connectPayplus, disconnectIntegration, saveRecognitionNames, startGmailConnection, type ConnectionResult } from "./actions";

interface Props {
  names: string[];
  connections: { provider: "gmail" | "payplus"; account_label: string }[];
  databaseReady: boolean;
  payplusReady: boolean;
  gmailReady: boolean;
  result?: string;
}
const messages: Record<string, string> = {
  connected: "חשבון Gmail חובר בהצלחה.",
  cancelled: "החיבור ל־Google בוטל. אפשר לנסות שוב.",
  failed: "חיבור Gmail לא הושלם. התחילי מחדש ואשרי גישה לקריאת המייל.",
  setup: "נדרשת הגדרה חד־פעמית של חיבור Google בשרת.",
};

export function ConnectionsForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>(messages[props.result ?? ""] ?? "");
  const [names, setNames] = useState<string>(props.names.join("\n"));
  const [confirmDisconnect, setConfirmDisconnect] = useState<"gmail" | "payplus" | null>(null);
  async function run(key: string, task: () => Promise<ConnectionResult>): Promise<boolean> {
    setBusy(key);
    setMessage("");
    try {
      const result: ConnectionResult = await task();
      setMessage(result.message);
      if (result.ok) router.refresh();
      return result.ok;
    } catch { setMessage("הפעולה לא הושלמה. בדקי את החיבור לרשת ונסי שוב."); return false; }
    finally { setBusy(null); }
  }
  const gmail = props.connections.find((connection) => connection.provider === "gmail");
  const payplus = props.connections.find((connection) => connection.provider === "payplus");
  return <div className="mx-auto flex max-w-3xl flex-col gap-5">
    <h1 className="text-2xl font-bold">חיבורים וייבוא</h1>
    <p>כאן מגדירים את החשבונות ואת השמות לזיהוי במסמכים. ההגדרות אישיות לחשבון שלך.</p>
    <div className="rounded-xl border border-border bg-primary/5 p-4">לאחר חיבור Gmail ושמירת השמות, אפשר לבחור טווח תאריכים ולייבא מסמכים לאישור. חיבור חשבון לבדו אינו מתחיל ייבוא.</div>
    {!props.databaseReady && <p role="alert">נדרשת הכנה חד־פעמית של מסד הנתונים לפני שמירת ההגדרות.</p>}
    <p role="status" aria-live="polite" className="empty:hidden">{message}</p>
    <Card>
      <h2 className="mb-3 text-xl font-semibold">שמות לזיהוי במסמכים</h2>
      <p className="mb-3">הזיני שם מלא, שם פרטי או כתיבים נוספים שתרצי לזהות — כל שם בשורה נפרדת. השמות ייבדקו מול מקבל המסמך. לא נוסיף שמות אוטומטית.</p>
      <form className="flex flex-col gap-3" onSubmit={async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await run("names", () => saveRecognitionNames(form)); }}>
        <label htmlFor="recognition-names">השמות שלי לזיהוי</label>
        <textarea id="recognition-names" name="names" rows={4} maxLength={1800} value={names} onChange={(event) => setNames(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3" aria-describedby="names-help" />
        <p id="names-help" className="text-sm">אפשר לשמור גם רשימה ריקה. בהמשך, רק התאמה ברורה תועבר אוטומטית לאישור; שם דומה או התאמה לא ודאית ידרשו בדיקה. תנועות לא יאושרו אוטומטית.</p>
        <Button type="submit" disabled={!props.databaseReady || busy !== null} isLoading={busy === "names"}>שמור שמות לזיהוי</Button>
      </form>
    </Card>
    <Card>
      <h2 className="mb-3 text-xl font-semibold">חיבור Gmail</h2>
      <p className="mb-3 break-words">{gmail ? `מחובר: ${gmail.account_label}` : "עדיין לא חובר חשבון מייל."}</p>
      <p className="mb-3 text-sm">Google תבקש הרשאת קריאה למיילים ולקבצים המצורפים. ההרשאה מאפשרת קריאת התיבה; השמות שתגדירי ישמשו לסינון בתוך המערכת. אין הרשאה לשלוח או למחוק הודעות.</p>
      {!props.gmailReady && <p className="mb-3">החיבור יהיה זמין לאחר השלמת הגדרת Google וההצפנה בשרת.</p>}
      <form action={startGmailConnection}><Button type="submit" disabled={!props.gmailReady || busy !== null}>{gmail ? "בחר חשבון Google מחדש" : "חבר חשבון Google"}</Button></form>
      {gmail && <p className="my-3"><Link href="/settings/integrations/gmail" className="text-primary underline">חיפוש וייבוא מסמכים מ־Gmail</Link></p>}
      {gmail && <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirmDisconnect("gmail")}>נתק Gmail</Button>}
    </Card>
    <Card>
      <h2 className="mb-3 text-xl font-semibold">חיבור PayPlus</h2>
      <p className="mb-3">{payplus ? "החשבון מחובר והרשאת הקריאה למסמכים נבדקה בזמן החיבור." : "הזיני את שני המפתחות שקיבלת מ־PayPlus. הם יישמרו מוצפנים ולא יוצגו שוב."}</p>
      <p className="mb-3 text-sm">החיבור נבדק מול מסמכים שהופקו בחשבון. זמינות חשבוניות העמלות של PayPlus דרך החיבור עדיין לא אומתה; מתוכנן לחפש אותן גם במייל.</p>
      {!props.payplusReady && <p className="mb-3">נדרשת השלמת הגדרת ההצפנה ומסד הנתונים לפני חיבור החשבון.</p>}
      <form className="flex flex-col gap-3" autoComplete="off" onSubmit={async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); if (await run("payplus", () => connectPayplus(form))) element.reset(); }}>
        <Input id="payplus-key" name="apiKey" label="מפתח חיבור" type="password" dir="ltr" autoComplete="new-password" required maxLength={512} disabled={!props.payplusReady} />
        <Input id="payplus-secret" name="secretKey" label="מפתח סודי" type="password" dir="ltr" autoComplete="new-password" required maxLength={512} disabled={!props.payplusReady} />
        <Button type="submit" disabled={!props.payplusReady || busy !== null} isLoading={busy === "payplus"}>{payplus ? "בדוק והחלף פרטי חיבור" : "בדוק וחבר חשבון"}</Button>
      </form>
      {payplus && <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirmDisconnect("payplus")}>נתק PayPlus</Button>}
    </Card>
    {confirmDisconnect && <div className="rounded-xl border border-border p-4" role="region" aria-label="אישור ניתוק"><p className="mb-3">לנתק את החשבון? המסמכים שכבר נמצאים במערכת יישארו בה.</p><div className="flex flex-wrap gap-3"><Button disabled={busy !== null} onClick={async () => { const provider = confirmDisconnect; await run("disconnect", () => disconnectIntegration(provider)); setConfirmDisconnect(null); }}>כן, נתק</Button><Button variant="secondary" disabled={busy !== null} onClick={() => setConfirmDisconnect(null)}>ביטול</Button></div></div>}
  </div>;
}
