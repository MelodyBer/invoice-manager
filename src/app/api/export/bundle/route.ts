import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { loadExportRequestData } from "@/lib/export/route-helpers";
import { buildExportWorkbook } from "@/lib/export/build-workbook";
import { populateDocumentsZip } from "@/lib/export/build-zip";
import { buildExportBaseName, contentDisposition, sanitizeFileNamePart } from "@/lib/export/filenames";

/** "ייצא הכל": bundles the Excel file with the period's original documents in a single ZIP.
 * The printable report can't join this bundle without a PDF-generation library (explicitly out of scope),
 * so it stays a separate "open in new tab and print" action on the export screen. */
export async function GET(request: NextRequest): Promise<Response> {
  const result = await loadExportRequestData(request);
  if (result instanceof NextResponse) return result;
  const { supabase, data } = result;
  if (data.rows.length === 0) return NextResponse.json({ error: "אין נתונים לייצוא בטווח שנבחר." }, { status: 404 });
  const fileName = buildExportBaseName(data.profile.business_name, data.range.label);
  const zip = new JSZip();
  zip.file(`${sanitizeFileNamePart(fileName)}.xlsx`, buildExportWorkbook(data));
  try {
    await populateDocumentsZip(zip, supabase, data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "בניית קובץ המסמכים נכשלה." }, { status: 500 });
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(buffer as unknown as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": contentDisposition(fileName, "zip") } });
}
