"use client";

import Link from "next/link";
import { validDate } from "@/lib/transactions/reporting";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Dialog, Spinner, useToast } from "@/components/ui";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { useTransactionForm } from "@/lib/transactions/use-transaction-form";
import { buildEmptyManualValues } from "@/lib/transactions/build-initial-values";
import { findDuplicateTransactionId } from "@/lib/transactions/duplicate-check";
import { validateTransactionValues } from "@/lib/transactions/validate-values";
import { insertTransaction } from "@/lib/transactions/save-transaction";
import type { CategoryRow, ProfileRow } from "@/types/db";

type DuplicatePendingAction = "save" | null;

interface DuplicateDialogState {
  isOpen: boolean;
  existingTransactionId: string | null;
  pendingAction: DuplicatePendingAction;
}

const EMPTY_DUPLICATE_STATE: DuplicateDialogState = { isOpen: false, pendingAction: null, existingTransactionId: null };

export default function NewTransactionPage(): React.JSX.Element {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateState, setDuplicateState] = useState<DuplicateDialogState>(EMPTY_DUPLICATE_STATE);

  const form = useTransactionForm(useMemo(() => buildEmptyManualValues(null), []));

  useEffect(() => {
    let isCancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;
      if (!currentUserId) { router.replace("/login"); return; }

      const [{ data: profileData }, { data: categoriesData }] = await Promise.all([
        currentUserId
          ? supabase.from("profiles").select("*").eq("id", currentUserId).single()
          : Promise.resolve({ data: null as ProfileRow | null }),
        supabase.from("categories").select("*").eq("user_id", currentUserId).order("name"),
      ]);

      if (isCancelled) {
        return;
      }

      setUserId(currentUserId);
      setCategories(categoriesData ?? []);
      const date = new URLSearchParams(window.location.search).get("date") ?? "";
      form.resetTo({ ...buildEmptyManualValues(profileData ?? null), docDate: validDate(date) ? date : "" });
      setIsLoading(false);
    }

    void load();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function performSave(): Promise<void> {
    if (!userId) {
      showToast("לא זוהה משתמש מחובר.", "error");
      return;
    }
    setIsSaving(true);
    const { errorMessage } = await insertTransaction(supabase, userId, null, form.values);
    setIsSaving(false);

    if (errorMessage) {
      showToast(errorMessage, "error");
      return;
    }

    showToast("התנועה נשמרה בהצלחה");
    router.push("/transactions");
  }

  async function handleSaveClick(): Promise<void> {
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
      setDuplicateState({ isOpen: true, pendingAction: "save", existingTransactionId: existingId });
      return;
    }

    await performSave();
  }

  function handleDuplicateCancel(): void {
    setDuplicateState(EMPTY_DUPLICATE_STATE);
  }

  async function handleDuplicateConfirm(): Promise<void> {
    setDuplicateState(EMPTY_DUPLICATE_STATE);
    await performSave();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">תנועה חדשה</h1>
        <Link href="/documents" className="text-sm text-primary hover:underline">
          חזרה לרשימת המסמכים
        </Link>
      </div>

      <div className="max-w-xl">
        <TransactionForm
          values={form.values}
          onFieldChange={form.setField}
          categories={categories}
          confidence={null}
          isVatManuallyEdited={form.isVatManuallyEdited}
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={() => void handleSaveClick()} isLoading={isSaving}>
          אשר ושמור
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
