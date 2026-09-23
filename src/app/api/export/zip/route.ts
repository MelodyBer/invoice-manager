import { NextResponse, type NextRequest } from "next/server";
import { loadExportRequestData } from "@/lib/export/route-helpers";
import { buildDocumentsZip } from "@/lib/export/build-zip";
import { buildExportBaseName, contentDisposition } from "@/lib/export/filenames";

export async function GET(request: NextRequest): Promise<Response> {
  const result = await loadExportRequestData(request);
  if (result instanceof NextResponse) return result;
  const { supabase, data } = result;
  if (data.documents.length === 0) return NextResponse.json({ error: "אין מסמכים מצורפים בטווח שנבחר." }, { status: 404 });
  let buffer: Buffer;
  try {
    buffer = await buildDocumentsZip(supabase, data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "בניית קובץ המסמכים נכשלה." }, { status: 500 });
  }
  const fileName = buildExportBaseName(data.profile.business_name, data.range.label);
  return new Response(buffer as unknown as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": contentDisposition(`${fileName}_מסמכים`, "zip") } });
}
