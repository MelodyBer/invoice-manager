"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui";
import { DocumentViewer } from "./DocumentViewer";
import { RemoveReviewDocument } from "./RemoveReviewDocument";
import { MoneySummary } from "@/components/transactions/MoneySummary";
import { createClient } from "@/lib/supabase/client";
import { findApprovedDuplicateId } from "@/lib/transactions/duplicate-check";
import { getDetail, type Detail } from "@/lib/transactions/detail-actions";
import type { DocumentRow } from "@/types/db";
import type { TransactionFormValues } from "@/types/transaction-form";

interface Props {
  document: DocumentRow;
  userId: string;
  values: TransactionFormValues;
  enabled: boolean;
  mobileTab: "document" | "form";
  children: ReactNode;
}

export function ReviewComparison({ document, userId, values, enabled, mobileTab, children }: Props): React.JSX.Element {
  const [supabase] = useState(() => createClient());
  const [match, setMatch] = useState<{ key: string; id: string } | null>(null);
  const [checkError, setCheckError] = useState("");
  const [retry, setRetry] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const { counterpartyName, docNumber, docDate, docType, direction } = values;
  const key = JSON.stringify([document.id, userId, counterpartyName, docNumber, docDate, docType, direction, enabled]);
  const duplicateId = match?.key === key ? match.id : null;
  const comparing = Boolean(duplicateId && openId === duplicateId);

  useEffect(() => {
    let active = true;
    setMatch(null); setCheckError(""); setOpenId(null);
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void findApprovedDuplicateId(supabase, userId, { counterpartyName, docNumber, docDate, docType, direction })
        .then(id => { if (active) setMatch(id ? { key, id } : null); })
        .catch(() => { if (active) setCheckError("לא ניתן לבדוק כרגע אם המסמך כבר אושר."); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [supabase, userId, counterpartyName, docNumber, docDate, docType, direction, enabled, key, retry]);

  useEffect(() => {
    let active = true;
    setDetail(null); setDetailError("");
    if (!comparing || !duplicateId) return;
    void getDetail(duplicateId).then(result => {
      if (!active) return;
      if (result.detail?.transaction.is_verified) setDetail(result.detail);
      else setDetailError(result.error ?? "המסמך המאושר אינו זמין עוד.");
    }).catch(() => { if (active) setDetailError("טעינת המסמך המאושר נכשלה. נסי שוב."); });
    return () => { active = false; };
  }, [comparing, duplicateId, detailRetry]);

  return <>
    {checkError && <div role="status" className="rounded-lg border border-warning p-3"><p>{checkError}</p><Button variant="secondary" onClick={() => setRetry(current => current + 1)}>נסה שוב</Button></div>}
    {duplicateId && <section aria-label="מסמך שכבר אושר" className="rounded-xl border border-warning bg-warning/10 p-4">
      <p role="status" className="font-bold">קיים כבר מסמך מאושר עם אותם פרטים במערכת. האם להסיר את המסמך הכפול מהאישור?</p>
      <p className="mt-2 text-sm">נמצאו שם, מספר מסמך, תאריך וסוג מסמך תואמים. השווי למסמך המאושר לפני ההסרה. ההסרה היא מתור האישור בלבד; התנועה המאושרת והקבצים נשמרים.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" aria-expanded={comparing} aria-controls="approved-comparison" onClick={() => setOpenId(comparing ? null : duplicateId)}>{comparing ? "סגירת ההשוואה" : "הצגת המסמך המאושר לצד הפרטים"}</Button><RemoveReviewDocument id={document.id} returnToList label="הסר את המסמך הכפול מהאישור" /></div>
    </section>}
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className={mobileTab === "form" || comparing ? "min-w-0" : "hidden min-w-0 lg:block"}>
        {comparing && <h2 className="mb-3 font-bold">פרטי המסמך הממתין לאישור</h2>}
        {children}
      </div>
      <div className={mobileTab === "document" || comparing ? "min-w-0 lg:sticky lg:top-4" : "hidden min-w-0 lg:sticky lg:top-4 lg:block"}>
        {comparing ? <aside id="approved-comparison" aria-label="השוואה למסמך המאושר" className="mt-4 rounded-xl border border-primary bg-background p-4 lg:mt-0 lg:max-h-[85vh] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2"><h2 className="font-bold">המסמך שכבר אושר</h2><Button variant="ghost" onClick={() => setOpenId(null)}>סגירת ההשוואה</Button></div>
          {!detail && !detailError && <div role="status" className="flex items-center gap-2 py-6"><Spinner size={24} />טוען את המסמך המאושר…</div>}
          {detailError && <div role="alert"><p>{detailError}</p><Button variant="secondary" onClick={() => setDetailRetry(current => current + 1)}>נסה שוב</Button></div>}
          {detail && <><p className="mt-3">{detail.transaction.counterparty_name} · מספר {detail.transaction.doc_number ?? "לא צוין"}</p><MoneySummary value={detail.transaction} date={detail.transaction.doc_date} needsReview={detail.transaction.currency_review_required} />
            {detail.documents.length ? detail.documents.map(item => <div key={item.id} className="mt-3"><p className="mb-2 break-words text-sm">{item.file_name}</p><DocumentViewer storagePath={item.storage_path} mimeType={item.mime_type} /></div>) : <p>התנועה נשמרה ללא קובץ מצורף. אפשר להשוות לפרטים שמופיעים כאן.</p>}</>}
          <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer font-medium">הצגת הקובץ הממתין לאישור להשוואה</summary><div className="mt-3"><DocumentViewer key={document.id} storagePath={document.storage_path} mimeType={document.mime_type} /></div></details>
        </aside> : <DocumentViewer key={document.id} storagePath={document.storage_path} mimeType={document.mime_type} />}
      </div>
    </div>
  </>;
}
