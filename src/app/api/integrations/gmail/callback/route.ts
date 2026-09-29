import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { connectGoogle, OAUTH_COOKIE, COOKIE_PATH, googleConfig } from "@/lib/integrations/providers";
import { seal, validateAttempt } from "@/lib/integrations/security";

export const runtime: string = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let result: string = "failed";
  const jar = await cookies();
  const encrypted: string | undefined = jar.get(OAUTH_COOKIE)?.value;
  jar.set(OAUTH_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const state: string = request.nextUrl.searchParams.get("state") ?? "";
    const code: string | null = request.nextUrl.searchParams.get("code");
    if (error || !data.user || !encrypted) throw new Error("invalid-session");
    const attempt = validateAttempt(encrypted, data.user.id, state);
    if (request.nextUrl.searchParams.has("error")) result = "cancelled";
    else if (code) {
      const account = await connectGoogle(code, attempt.verifier);
      const { error: saveError } = await supabase.from("integration_connections").upsert({ user_id: data.user.id, provider: "gmail", account_label: account.email, encrypted_credentials: seal(JSON.stringify({ refreshToken: account.refreshToken }), `${data.user.id}:gmail`), connected_at: new Date().toISOString() });
      if (saveError) throw new Error("save-failed");
      result = "connected";
    }
  } catch { /* Do not log codes, account identifiers, credentials or provider payloads. */ }
  let target: URL;
  try { target = new URL("/settings/integrations", googleConfig().redirectUri); }
  catch { return NextResponse.json({ error: "נדרשת השלמת הגדרת החיבור בשרת. חזרי למסך החיבורים." }, { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
  target.searchParams.set("connection", result);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
