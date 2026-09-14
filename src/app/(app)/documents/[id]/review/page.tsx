"use client";

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

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;
      if (!currentUserId) { router.replace("/login"); return; }

      const [documentResult, categoriesResult, profileResult, pendingDocs, existing] = await Promise.all([
        supabase.from("documents").select("*").eq("user_id", currentUserId).eq("id", documentId).single(),
        supabase.from("categories").select("*").eq("user_id", currentUserId).order("name"),
        supabase.from("profiles").select("*").eq("id", currentUserId).single(),
        loadReviewQueue(supabase, currentUserId),
        supabase.from("transactions").select("id").eq("user_id", currentUserId).eq("document_id", documentId).eq("is_verified", true).limit(1).maybeSingle(),
      ]);
      if (isCancelled) return;
      if (documentResult.error || categoriesResult.error || profileResult.error || existing.error) throw new Error("טעינת המסמך נכשלה");
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

  const confidence = getExtractionConfidence(documentRow?.extraction_raw ?? null);
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
    try { ({ errorMessage } = await insertTransaction(supabase, userId, documentId, form.values)); }
    catch { errorMessage = "השמירה נכשלה. בדקי את החיבור ונסי שוב."; }
    setIsSaving(false);

    if (errorMessage) {
      showToast(errorMessage, "error");
      return;
    }

    showToast("המסמך אושר ונשמר בתנועות");
    router.refresh();

    if (andNext) {
      const nextId = currentIndex !== -1 ? queueIds[currentIndex + 1] ?? queueIds.find(id => id !== documentId) : undefined;
      router.push(nextId ? `/documents/${nextId}/review` : "/documents");
    } else {
      router.push("/documents");
    }
  }

  async function handleSaveClick(andNext: boolean): Promise<void> {
    if (!userId || isSaving) return;
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

    if (existingId) {
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
          <fieldset disabled={isSaving}>
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
        <Button onClick={() => void handleSaveClick(false)} isLoading={isSaving}>
          אשר ושמור
        </Button>
        <Button variant="secondary" onClick={() => void handleSaveClick(true)} isLoading={isSaving}>
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
            <Button onClick={() => void handleDuplicateConfirm()} isLoading={isSaving}>
              שמור בכל זאת
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
