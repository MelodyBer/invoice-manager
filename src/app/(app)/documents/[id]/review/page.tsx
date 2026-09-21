"use client";

import { ReceiptAttachment } from "@/components/documents/ReceiptAttachment";
import { formFromTransaction } from "@/lib/transactions/form-from-transaction";
import { RemoveReviewDocument } from "@/components/documents/RemoveReviewDocument";
import { findDocumentPairs, approveDocumentPair, resolveInvoiceDuplicate, type PairCandidate } from "@/lib/transactions/pair-actions";
import { formatDateDDMMYYYY } from "@/lib/format";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Dialog, EmptyState, Spinner, useToast } from "@/components/ui";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { useTransactionForm } from "@/lib/transactions/use-transaction-form";
import {
  buildInitialValuesFromExtraction,
  getExtractionConfidence,
} from "@/lib/transactions/build-initial-values";
import { findDuplicateTransactionId } from "@/lib/transactions/duplicate-check";
import { validateTransactionValues } from "@/lib/transactions/validate-values";
import { insertTransaction } from "@/lib/transactions/save-transaction";
import { loadReviewQueue } from "@/lib/transactions/review-queue";
import type { TransactionFormValues } from "@/types/transaction-form";
import type { CategoryRow, DocumentRow } from "@/types/db";

type MobileTab = "document" | "form";
type DuplicatePendingAction = "save" | "saveAndNext" | null;

interface DuplicateDialogState {
  isOpen: boolean;
  existingTransactionId: string | null;
  pendingAction: DuplicatePendingAction;
}

const EMPTY_DUPLICATE_STATE: DuplicateDialogState = {
  isOpen: false,
  existingTransactionId: null,
  pendingAction: null,
};

const EMPTY_FORM_VALUES = buildInitialValuesFromExtraction("expense", null, null);

export default function DocumentReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState<string | null>(null);
  const [documentRow, setDocumentRow] = useState<DocumentRow | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [pairs, setPairs] = useState<PairCandidate[]>([]);
  const [sourcePairValues,setSourcePairValues] = useState<TransactionFormValues|null>(null);
  const [pair, setPair] = useState<PairCandidate | null>(null);
  const [separateConfirmed, setSeparateConfirmed] = useState(false);
  const [pairError, setPairError] = useState("");
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("form");
  const [duplicateState, setDuplicateState] = useState<DuplicateDialogState>(EMPTY_DUPLICATE_STATE);

  const form = useTransactionForm(useMemo(() => EMPTY_FORM_VALUES, []));

  useEffect(() => {
    let isCancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError("");
      setMobileTab("form");
      setPair(null);
      setSourcePairValues(null);
      setSeparateConfirmed(false);
      setPairs([]);
      setPairError("");
      setShowInvoiceSearch(false);

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;
      if (!currentUserId) { router.replace("/login"); return; }

      const [documentResult, categoriesResult, profileResult, pendingDocs, existing, pairResult] = await Promise.all([
        supabase.from("documents").select("*").eq("user_id", currentUserId).eq("id", documentId).single(),
        supabase.from("categories").select("*").eq("user_id", currentUserId).order("name"),
        supabase.from("profiles").select("*").eq("id", currentUserId).single(),
        loadReviewQueue(supabase, currentUserId),
        supabase.from("transactions").select("id").eq("user_id", currentUserId).eq("document_id", documentId).eq("is_verified", true).limit(1).maybeSingle(),
        findDocumentPairs(documentId),
      ]);
      if (isCancelled) return;
      if (documentResult.error || categoriesResult.error || profileResult.error || existing.error) throw new Error("טעינת המסמך נכשלה");
      if (documentResult.data?.dismissed_at) { router.replace("/documents"); return; }
      if (documentResult.data?.transaction_id) { router.replace(`/transactions/${documentResult.data.transaction_id}`); return; }
      setPairs(pairResult.candidates);
      setPairError(pairResult.error ?? "");
      if (existing.data) { router.replace(`/transactions/${existing.data.id}`); return; }
      const documentData = documentResult.data;
      const categoriesData = categoriesResult.data;
      const profileData = profileResult.data;
      const queue = pendingDocs.filter(document => document.status !== "processing").map(document => document.id);

      setUserId(currentUserId);
      setDocumentRow(documentData ?? null);
      setCategories(categoriesData ?? []);
      setQueueIds(queue);

      if (documentData) {
        form.resetTo(
          buildInitialValuesFromExtraction(
            documentData.direction,
            documentData.extraction_raw,
            profileData
          )
        );
      }

      setIsLoading(false);
    }

    void load().catch(() => { if (!isCancelled) { setLoadError("לא ניתן לטעון את המסמך. רענני ונסי שוב."); setIsLoading(false); } });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const invoiceDocument = documentRow?.extraction_raw?.doc_type === "invoice_tax" ? documentRow : pair?.document ?? documentRow;
  const confidence = getExtractionConfidence((pair ? invoiceDocument : documentRow)?.extraction_raw ?? null);
  function selectPair(candidate: PairCandidate | null): void {
    if(candidate && !pair)setSourcePairValues(form.values);
    if(!candidate && sourcePairValues){setPair(null);setSeparateConfirmed(false);form.resetTo(sourcePairValues);setSourcePairValues(null);return;}
    setPair(candidate);
    setShowInvoiceSearch(false);
    setSeparateConfirmed(false);
    const invoice = candidate && documentRow?.extraction_raw?.doc_type !== "invoice_tax" ? candidate.document : documentRow;
    if (!invoice) return;
    const t = candidate?.transaction;
    if(t?.doc_type === "invoice_tax") {
      form.resetTo(formFromTransaction(t));
    } else form.resetTo(buildInitialValuesFromExtraction(invoice.direction, invoice.extraction_raw, null));
  }
  const currentIndex = queueIds.indexOf(documentId);
  const queuePosition = currentIndex !== -1 ? currentIndex + 1 : null;

  function goToPrevious(): void {
    if (currentIndex > 0) {
      router.push(`/documents/${queueIds[currentIndex - 1]}/review`);
    }
  }

  function goToNext(): void {
    if (currentIndex !== -1 && currentIndex < queueIds.length - 1) {
      router.push(`/documents/${queueIds[currentIndex + 1]}/review`);
    }
  }

  async function performSave(andNext: boolean): Promise<void> {
    if (!userId) {
      showToast("לא זוהה משתמש מחובר.", "error");
      return;
    }
    setIsSaving(true);
    let errorMessage: string | null;
    try { ({ errorMessage } = pair ? await approveDocumentPair(documentId, pair.document.id, form.values, pair.transaction?.updated_at ?? null, sourcePairValues ?? undefined) : await insertTransaction(supabase, userId, documentId, form.values)); }
    catch { errorMessage = "השמירה נכשלה. בדקי את החיבור ונסי שוב."; }
    setIsSaving(false);

    if (errorMessage) {
      showToast(errorMessage, "error");
      return;
    }

    showToast("המסמך אושר ונשמר בתנועות");
    router.refresh();

    if (andNext) {
      const remaining = queueIds.filter(id => id !== documentId && id !== pair?.document.id);
      const nextId = remaining[0];
      router.push(nextId ? `/documents/${nextId}/review` : "/documents");
    } else {
      router.push("/documents");
    }
  }

  async function handleSaveClick(andNext: boolean): Promise<void> {
    if (!userId || isSaving || pairError) return;
    if (pairs.length && !pair && !separateConfirmed) { showToast("נמצאו מסמכים דומים. בחרי חיבור או אישור כעסקה נפרדת.", "error"); return; }
    const validation = validateTransactionValues(form.values);
    if (validation) { showToast(validation, "error"); return; }
    setIsSaving(true);
    let existingId: string | null;
    try {
      existingId = await findDuplicateTransactionId(supabase, userId, {
      counterpartyName: form.values.counterpartyName,
      docNumber: form.values.docNumber,
      docDate: form.values.docDate,
    });
    } catch { showToast("לא ניתן לבדוק כפילויות. נסי שוב.", "error"); return; }
    finally { setIsSaving(false); }

    if (existingId && existingId !== pair?.transaction?.id && !pair) {
      setIsSaving(true);
      try {
        const match = await resolveInvoiceDuplicate(documentId, existingId);
        if (match.error) { showToast(match.error, "error"); return; }
        if (match.candidate) {
          const candidate = match.candidate;
          setPairs(current => current.some(item => item.document.id === candidate.document.id) ? current : [...current, candidate]);
          selectPair(candidate);
          showToast("נמצאה חשבונית מאושרת מתאימה. בדקי את החיבור ולחצי שוב לאישור; הסכום יישמר פעם אחת.");
          window.scrollTo({top:0,behavior:"smooth"});
          return;
        }
        if (match.invoiceExists) {
          setShowInvoiceSearch(true);
          document.getElementById("document-linking")?.scrollIntoView({behavior:"smooth"});
          showToast("בחרי את החשבונית בחלונית הצירוף ולחצי צרף קבלה לחשבונית.");
          return;
        }
      } catch { showToast("בדיקת החשבונית נכשלה. נסי שוב.", "error"); return; }
      finally { setIsSaving(false); }
    }
    if (existingId && existingId !== pair?.transaction?.id) {
      setDuplicateState({
        isOpen: true,
        existingTransactionId: existingId,
        pendingAction: andNext ? "saveAndNext" : "save",
      });
      return;
    }

    await performSave(andNext);
  }

  function handleDuplicateCancel(): void {
    setDuplicateState(EMPTY_DUPLICATE_STATE);
  }

  async function handleDuplicateConfirm(): Promise<void> {
    const action = duplicateState.pendingAction;
    setDuplicateState(EMPTY_DUPLICATE_STATE);
    if (action) {
      await performSave(action === "saveAndNext");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} />
      </div>
    );
  }

  if (loadError) return <p role="alert">{loadError}</p>;

  if (!documentRow) {
    return <EmptyState title="המסמך לא נמצא" description="ייתכן שהוא נמחק או שאין לך הרשאה לצפות בו." />;
  }

  if (documentRow.status === "processing") {
    return <EmptyState title="המסמך עדיין בעיבוד" description="נסי לרענן בעוד רגע." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">אישור מסמך</h1>
        <Link href="/documents" className="text-sm text-primary hover:underline">
          חזרה לממתינים לאישור
        </Link>
      </div>

      <p className="text-sm text-foreground/60">בדקי את הפרטים מול המסמך. שדות בצהוב דורשים תשומת לב. לאחר האישור המסמך יעבור לתנועות.</p>
      <p className="truncate font-medium">{documentRow.file_name}</p>

      <RemoveReviewDocument id={documentId} returnToList />
      <section id="document-linking" aria-label="חיבור חשבונית וקבלה" className="space-y-3">
      {pairError && <p role="alert" className="rounded border border-warning p-3">{pairError}</p>}
      {pairs.length > 0 && <section className="rounded-xl border border-primary bg-primary/5 p-4"><h2 className="font-bold">נמצאה התאמה אפשרית למסמך</h2><p className="mt-2 text-sm">נמצאו שם או מספר עסק תואמים, סכום זהה ותאריכים קרובים. בדקי את שני המסמכים לפני החיבור. הסכום יירשם פעם אחת, לפי החשבונית.</p>{pairs.map(candidate => <div key={candidate.document.id} className="mt-3 rounded border border-border bg-background p-3"><p>{candidate.document.file_name}</p><p className="text-sm">מספר: {String(candidate.document.extraction_raw?.doc_number ?? "לא צוין")} · {formatDateDDMMYYYY(String(candidate.document.extraction_raw?.doc_date ?? ""))}</p>{candidate.transaction && <p className="text-sm">כבר קיימת תנועה למסמך זה. החיבור יצרף את המסמך לתנועה הקיימת, ללא תנועה נוספת.</p>}<Button variant={pair?.document.id === candidate.document.id ? "primary" : "secondary"} disabled={isSaving} onClick={() => selectPair(candidate)}>בחירת המסמך לחיבור</Button><details className="mt-3"><summary className="cursor-pointer text-primary">הצגת המסמך להתאמה</summary><DocumentViewer storagePath={candidate.document.storage_path} mimeType={candidate.document.mime_type} /></details></div>)}{!pair && <Button variant="ghost" disabled={isSaving} onClick={() => setSeparateConfirmed(true)}>{separateConfirmed ? "נבחר אישור כעסקה נפרדת" : "זו עסקה אחרת — אישור בנפרד"}</Button>}{pair && <div className="mt-3"><p className="font-medium">נבחרו שני מסמכים לתנועה אחת. בדקי את הפרטים ולחצי למטה על ״אשר חיבור ושמור כתנועה אחת״ להשלמת החיבור.</p>{pair.transaction?.doc_type === "invoice_tax" && <p>סכומי החשבונית שכבר אושרה נשארים כפי שנשמרו. אפשר לערוך אותם דרך התנועות.</p>}{pair.transaction?.doc_type === "receipt" && <p>התנועה שנשמרה כקבלה תעודכן לפי פרטי החשבונית שבטופס. בדקי אותם לפני האישור.</p>}<Button variant="ghost" disabled={isSaving} onClick={() => selectPair(null)}>ביטול החיבור</Button></div>}</section>}
      {!pair && form.values.docType === "receipt" && <div className="rounded-xl border border-border p-4">
        {!pairs.length && <p className="mb-2 text-sm">לא נמצאה התאמה אוטומטית. אם כבר אישרת חשבונית עבור הקבלה הזו, אפשר לחפש אותה ולצרף אליה את הקבלה. אחרת, בדקי את הפרטים ואשרי כתנועה חדשה.</p>}
        <Button variant="secondary" disabled={isSaving} aria-expanded={showInvoiceSearch} aria-controls="invoice-search-panel" onClick={() => setShowInvoiceSearch(current => !current)}>
          {showInvoiceSearch ? "סגירת החיפוש" : pairs.length ? "חיפוש חשבונית אחרת" : "חיפוש חשבונית שכבר אושרה"}
        </Button>
        {showInvoiceSearch && <div id="invoice-search-panel" className="mt-3"><ReceiptAttachment documentId={documentId} values={form.values} /></div>}
      </div>}
      </section>
      {queuePosition ? (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={isSaving || currentIndex <= 0}
            aria-label="מסמך קודם"
            className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5 disabled:opacity-40"
          >
            ›
          </button>
          <span className="text-sm text-foreground/70">
            מסמך {queuePosition} מתוך {queueIds.length}
          </span>
          <button
            type="button"
            onClick={goToNext}
            disabled={isSaving || currentIndex === -1 || currentIndex >= queueIds.length - 1}
            aria-label="מסמך הבא"
            className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-foreground/5 disabled:opacity-40"
          >
            ‹
          </button>
        </div>
      ) : null}

      <div className="mb-2 flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("document")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            mobileTab === "document" ? "bg-primary text-white" : "border border-border text-foreground"
          }`}
        >
          מסמך
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            mobileTab === "form" ? "bg-primary text-white" : "border border-border text-foreground"
          }`}
        >
          פרטים לאישור
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className={mobileTab === "form" ? "block" : "hidden lg:block"}>
          <fieldset disabled={isSaving || pair?.transaction?.doc_type === "invoice_tax"}>
          <TransactionForm
            values={form.values}
            onFieldChange={form.setField}
            categories={categories}
            confidence={confidence}
            isVatManuallyEdited={form.isVatManuallyEdited}
          />
          </fieldset>
        </div>
        <div className={mobileTab === "document" ? "block lg:sticky lg:top-4" : "hidden lg:sticky lg:top-4 lg:block"}>
          <DocumentViewer key={documentRow.id} storagePath={documentRow.storage_path} mimeType={documentRow.mime_type} />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-border bg-background p-4 shadow-lg">
        <Button onClick={() => void handleSaveClick(false)} isLoading={isSaving} disabled={Boolean(pairError)}>
          {pair ? "אשר חיבור ושמור כתנועה אחת" : "אשר ושמור"}
        </Button>
        <Button variant="secondary" onClick={() => void handleSaveClick(true)} isLoading={isSaving} disabled={Boolean(pairError)}>
          אשר ועבור לבא
        </Button>
      </div>

      <Dialog
        isOpen={duplicateState.isOpen}
        onClose={handleDuplicateCancel}
        title="נראה שהמסמך הזה כבר קיים במערכת"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/70">
            נמצאה תנועה קיימת עם אותו ספק/לקוח, מספר מסמך ותאריך.
          </p>
          <Link href={`/transactions/${duplicateState.existingTransactionId}`} className="text-sm text-primary hover:underline">
            צפייה בתנועה הקיימת
          </Link>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleDuplicateCancel}>
              ביטול
            </Button>
            <Button onClick={() => void handleDuplicateConfirm()} isLoading={isSaving} disabled={Boolean(pairError)}>
              שמור בכל זאת
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
