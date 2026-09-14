import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ExtractionError, extractDocumentData } from "@/lib/extraction/extract-document";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "לא מחוברת למערכת." }, { status: 401 });
  }

  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ success: false, error: "המסמך לא נמצא." }, { status: 404 });
  }

  await supabase.from("documents").update({ status: "processing" }).eq("id", id).eq("user_id", user.id);

  try {
    const result = await extractDocumentData(supabase, document);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof ExtractionError ? error.message : "החילוץ נכשל. נסי שוב.";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
