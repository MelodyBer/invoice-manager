import { NextResponse, type NextRequest } from "next/server";
import { loadExportRequestData } from "@/lib/export/route-helpers";
import { buildExportWorkbook } from "@/lib/export/build-workbook";
import { buildExportBaseName, contentDisposition } from "@/lib/export/filenames";

export async function GET(request: NextRequest): Promise<Response> {
  const result = await loadExportRequestData(request);
  if (result instanceof NextResponse) return result;
  const { data } = result;
  if (data.rows.length === 0) return NextResponse.json({ error: "אין תנועות לייצוא בטווח שנבחר." }, { status: 404 });
  const buffer = buildExportWorkbook(data);
  const fileName = buildExportBaseName(data.profile.business_name, data.range.label);
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(fileName, "xlsx"),
    },
  });
}
