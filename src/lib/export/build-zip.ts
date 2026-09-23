import "server-only";
import JSZip from "jszip";
import type { createClient } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/format";
import { getExtensionFromMimeType } from "@/lib/upload/storage-path";
import { sanitizeFileNamePart, uniqueFileName } from "./filenames";
import type { Direction } from "@/types/db";
import type { ExportData } from "./load-export-data";

const DIRECTION_FOLDER: Record<Direction, string> = { expense: "הוצאות", income: "הכנסות" };

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Adds the period's original documents, grouped by direction, plus an index.csv linking each file back to its transaction. */
export async function populateDocumentsZip(zip: JSZip, supabase: Awaited<ReturnType<typeof createClient>>, data: ExportData): Promise<number> {
  const rowsById = new Map(data.rows.map(row => [row.id, row]));
  const usedNames: Record<Direction, Set<string>> = { expense: new Set(), income: new Set() };
  const indexRows: string[] = ["קובץ,סוג,תאריך,שם ספק או לקוח,מספר מסמך,סכום כולל"];
  let count = 0;

  for (const document of data.documents) {
    const transaction = rowsById.get(document.transactionId);
    if (!transaction) continue;
    const { data: blob, error } = await supabase.storage.from("documents").download(document.storagePath);
    if (error || !blob) throw new Error("הורדת אחד הקבצים נכשלה. נסי שוב.");
    const extension = getExtensionFromMimeType(document.mimeType);
    const baseName = sanitizeFileNamePart(`${formatDateDDMMYYYY(transaction.doc_date).replaceAll("/", "-")}_${transaction.counterparty_name}_${transaction.amount_total.toFixed(2)}`);
    const folder = DIRECTION_FOLDER[transaction.direction];
    const fileName = uniqueFileName(baseName, extension, usedNames[transaction.direction]);
    zip.file(`${folder}/${fileName}`, await blob.arrayBuffer());
    indexRows.push([`${folder}/${fileName}`, transaction.direction === "income" ? "הכנסה" : "הוצאה", formatDateDDMMYYYY(transaction.doc_date), transaction.counterparty_name, transaction.doc_number ?? "", transaction.amount_total.toFixed(2)].map(csvField).join(","));
    count++;
  }

  zip.file("index.csv", `﻿${indexRows.join("\r\n")}`);
  return count;
}

export async function buildDocumentsZip(supabase: Awaited<ReturnType<typeof createClient>>, data: ExportData): Promise<Buffer> {
  const zip = new JSZip();
  await populateDocumentsZip(zip, supabase, data);
  return zip.generateAsync({ type: "nodebuffer" });
}
