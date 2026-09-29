"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { formatDateDDMMYYYY } from "@/lib/format";
import type { ImportView, ImportState } from "@/types/gmail-import";
import { searchGmail, checkGmailItem, decideGmailItem, showGmailItem, refreshGmailItems } from "./actions";

const labels: Record<ImportState, string> = { pending: "ממתין לבדיקה", processing: "מזהה נתונים…", review: "נדרשת בדיקת התאמה", ignored: "לא יובא", duplicate: "קובץ חוזר — לא יובא", imported: "הועבר למסמכים לאישור", failed: "הבדיקה נכשלה" };
interface Props { mailbox: string; names: string[]; initial: ImportView[]; initialMore: boolean }
export function GmailImport({ mailbox, names, initial, initialMore }: Props): React.JSX.Element {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [items, setItems] = useState<ImportView[]>(initial);
  const [more, setMore] = useState<boolean>(initialMore);
  const [offset, setOffset] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const stop = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);
  const running = useRef<boolean>(false);
  const notice = useRef<HTMLParagraphElement>(null);
  const previewSection = useRef<HTMLElement>(null);
  useEffect(() => { if (preview) previewSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [preview]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function refresh(page: number = offset): Promise<void> {
    const result = await refreshGmailItems(page);
    if (!mounted.current) return;
    if (result.message) { setMessage(result.message); return; }
    setItems(result.rows); setMore(result.more); setOffset(page);
  }
  async function run(task: () => Promise<void>): Promise<void> {
    if (running.current) return;
    running.current = true; stop.current = false; setBusy(true); setMessage("");
    try { await task(); }
    catch { if (mounted.current) setMessage("הפעולה נקטעה. בדקי את החיבור ונסי שוב. הקבצים שכבר טופלו נשמרו."); }
    finally { running.current = false; if (mounted.current) { setBusy(false); notice.current?.focus(); } }
  }
  async function search(next: string | null): Promise<void> {
    await run(async () => {
      let token: string | null = next; let searched: number = 0; let checked: number = 0; let failed: number = 0;
      for (let page: number = 0; page < 10 && !stop.current; page++) {
        setMessage(`מחפשת מיילים… נבדקו ${searched} מיילים ו־${checked} קבצים.`);
        const result = await searchGmail(start, end, token);
        if (!result.ok) { setMessage(result.message); await refresh(0); return; }
        searched += result.searched;
        token = result.next; setCursor(token);
        await refresh(0);
        for (const id of result.ids) {
          if (stop.current) break;
          setMessage(`מזהה מסמכים… נבדקו ${checked} קבצים. אפשר לעצור אחרי הקובץ הנוכחי.`);
          const checkedResult = await checkGmailItem(id);
          checked++; if (!checkedResult.ok) failed++;
          await refresh(0);
        }
        if (!token) break;
      }
      if (mounted.current) setMessage(`${stop.current ? "החיפוש נעצר" : token ? "הסתיימה קבוצת החיפוש; יש מיילים נוספים" : "החיפוש הסתיים"}. נבדקו ${searched} מיילים ו־${checked} קבצים${failed ? `; ${failed} בדיקות נכשלו — ניתן לנסות שוב ברשימה` : ""}. התאמות ברורות הועברו למסמכים לאישור. אם נשארו קבצים ממתינים, אפשר להמשיך לבדוק אותם מהרשימה.`);
    });
  }
  return <div className="mx-auto flex max-w-5xl flex-col gap-5">
    <header><h1 className="text-2xl font-bold">ייבוא מסמכים מ־Gmail</h1><p className="mt-2 break-all" dir="auto">{mailbox}</p></header>
    <Card><p>שמות לזיהוי: {names.join(" · ")}</p><Link href="/settings/integrations" className="text-primary underline">עריכת השמות והחיבור</Link></Card>
    <Card>
      <p className="mb-3">בחרי טווח לפי תאריך קבלת המייל, לא לפי תאריך החשבונית. נחפש קובצי PDF, JPG ו־PNG עד 10 מגה־בייט. בשלב הזה לא נפתחים קישורי הורדה בגוף המייל, הודעות שנשלחו, ספאם או אשפה.</p>
      <p className="mb-4 text-sm">הקבצים הנתמכים ייבדקו בשירות זיהוי המסמכים של המערכת כדי לקרוא את שם מקבל המסמך. התאמה ברורה תתווסף כהוצאה הממתינה לאישור; התאמה לא ודאית תמתין לבחירה שלך כאן. לא נוצרות תנועות מאושרות אוטומטית.</p>
      <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setCursor(null); void search(null); }} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <fieldset disabled={busy} className="contents"><HebrewDatePicker id="gmail-from" label="מתאריך קבלת מייל" value={start} onChange={(value: string) => { setStart(value); setCursor(null); }} />
        <HebrewDatePicker id="gmail-to" label="עד תאריך קבלת מייל" value={end} onChange={(value: string) => { setEnd(value); setCursor(null); }} /></fieldset>
        <Button type="submit" disabled={busy || !start || !end}>חפש וייבא מסמכים מתאימים</Button>
        {cursor && <Button type="button" variant="secondary" disabled={busy} onClick={() => void search(cursor)}>המשך למיילים נוספים</Button>}
        {busy && <Button type="button" variant="secondary" onClick={() => { stop.current = true; setMessage("עוצרת לאחר סיום הפעולה הנוכחית…"); }}>עצור אחרי הפעולה הנוכחית</Button>}
      </form>
    </Card>
    <p role="status" aria-live="polite" tabIndex={-1} ref={notice}>{message}</p>
    <Link href="/documents" className="text-primary underline">למסמכים שממתינים לאישור</Link>
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">תוצאות הייבוא</h2><Button variant="secondary" disabled={busy} onClick={() => void run(() => refresh())}>רענן תוצאות</Button></div>
    {!items.length && <p>עדיין אין קבצים בתור הייבוא. בחרי טווח תאריכים והתחילי חיפוש.</p>}
    <ul className="space-y-3">{items.map((item: ImportView) => <li key={item.id} className="min-w-0"><Card className="min-w-0">
      <p dir="auto" title={item.file_name} className="truncate font-semibold">{item.file_name}</p>
      <p className="mt-2 text-sm">התקבל ב־{formatDateDDMMYYYY(item.received_on)} · {labels[item.state]}</p>
      {item.recipient_name && <p className="mt-2 break-words">שם מקבל המסמך שזוהה: {item.recipient_name}</p>}
      {item.reason && <p className="mt-2 text-sm">{item.reason}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {item.state === "review" && <>
          <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const result = await showGmailItem(item.id); if (result.url) setPreview({ url: result.url, name: item.file_name }); else setMessage(result.message); })}>הצג מסמך לבדיקה</Button>
          <Button disabled={busy} onClick={() => void run(async () => { const result = await decideGmailItem(item.id, "import"); setMessage(result.message); await refresh(); })}>המסמך שלי — העבר לאישור</Button>
          <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { const result = await decideGmailItem(item.id, "ignore"); setMessage(result.message); await refresh(); })}>לא לייבא</Button>
        </>}
        {["pending", "failed", "processing", "ignored"].includes(item.state) && <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const result = await checkGmailItem(item.id); setMessage(result.message); await refresh(); })}>{item.state === "pending" ? "בדוק מסמך" : "בדוק מחדש"}</Button>}
        {item.state === "imported" && item.document_id && <Link href={`/documents/${item.document_id}/review`} className="text-primary underline">פתח את המסמך</Link>}
      </div>
    </Card></li>)}</ul>
    <div className="flex gap-3"><Button variant="secondary" disabled={busy || offset === 0} onClick={() => void run(() => refresh(Math.max(0, offset - 50)))}>הקודם</Button><Button variant="secondary" disabled={busy || !more} onClick={() => void run(() => refresh(offset + 50))}>הבא</Button></div>
    {preview && <section ref={previewSection} className="rounded-xl border border-border p-3" aria-label="תצוגת המסמך"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="min-w-0 truncate">{preview.name}</h2><Button variant="secondary" onClick={() => setPreview(null)}>סגור תצוגה</Button></div><iframe title="המסמך לבדיקת התאמה" src={preview.url} className="h-[65vh] w-full rounded-lg border border-border" referrerPolicy="no-referrer" /><a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">פתח את המסמך בלשונית נוספת</a><p className="mt-2 text-sm">התצוגה זמינה לחמש דקות. אם פגה, לחצי שוב על הצגת המסמך.</p></section>}
  </div>;
}
