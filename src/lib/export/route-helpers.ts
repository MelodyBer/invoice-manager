import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveExportRange } from "./range";
import { loadExportData, type ExportData } from "./load-export-data";

export type ExportRequestData = { supabase: Awaited<ReturnType<typeof createClient>>; data: ExportData };

/** Shared auth + range-resolution + data-loading for the three export download routes. */
export async function loadExportRequestData(request: NextRequest): Promise<ExportRequestData | NextResponse> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "לא מחוברת למערכת." }, { status: 401 });
  const profile = await supabase.from("profiles").select("reporting_frequency").eq("id", auth.user.id).single();
  if (profile.error || !profile.data) return NextResponse.json({ error: "לא ניתן לטעון את ההגדרות. רענני ונסי שוב." }, { status: 400 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  try {
    const range = resolveExportRange(params, profile.data.reporting_frequency);
    const data = await loadExportData(supabase, auth.user.id, range);
    return { supabase, data };
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "טעינת הנתונים נכשלה." }, { status: 400 });
  }
}
