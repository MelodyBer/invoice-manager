"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { formatDateDDMMYYYY, formatFileSize } from "@/lib/format";
import type { DocumentRow, DocumentStatus } from "@/types/db";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "ממתין לעיבוד",
  processing: "בעיבוד",
  processed: "עובד",
  failed: "נכשל",
};

export default function DocumentsPage(): React.JSX.Element {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);

  useEffect(() => {
    async function loadDocuments(): Promise<void> {
      const supabase = createClient();
      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("uploaded_at", { ascending: false });
      setDocuments(data ?? []);
    }
    void loadDocuments();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-foreground">מסמכים</h1>

      {documents === null ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="עדיין לא הועלו מסמכים"
          description="ניתן להעלות חשבוניות וקבלות במסך העלאת מסמך."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
                  <p className="text-xs text-foreground/60">
                    {formatDateDDMMYYYY(doc.uploaded_at)} · {formatFileSize(doc.file_size)} ·{" "}
                    {STATUS_LABELS[doc.status]}
                  </p>
                </div>
                <Badge variant={doc.direction === "income" ? "income" : "expense"}>
                  {doc.direction === "income" ? "הכנסה" : "הוצאה"}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
