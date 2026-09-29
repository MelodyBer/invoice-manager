"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userContext } from "@/lib/transactions/load-range";
import { credential, verifyPayplus, authorizationUrl, OAUTH_COOKIE, COOKIE_PATH, revokeGoogle } from "@/lib/integrations/providers";
import { encryptionReady, newOAuthAttempt, parseNames, seal, unseal, record } from "@/lib/integrations/security";

export interface ConnectionResult { ok: boolean; message: string }
const path: string = "/settings/integrations";

export async function saveRecognitionNames(form: FormData): Promise<ConnectionResult> {
  const { supabase, userId } = await userContext();
  let names: string[];
  try { names = parseNames(form.get("names")); } catch { return { ok: false, message: "הזיני עד 20 שמות, כל שם בשורה נפרדת ובאורך 2–80 תווים." }; }
  const { error } = await supabase.from("integration_settings").upsert({ user_id: userId, recognition_names: names, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: "ההגדרות לא נשמרו. ודאי שהכנת מסד הנתונים הושלמה ונסי שוב." };
  revalidatePath(path);
  return { ok: true, message: "השמות לזיהוי נשמרו." };
}

export async function connectPayplus(form: FormData): Promise<ConnectionResult> {
  const { supabase, userId } = await userContext();
  if (!encryptionReady()) return { ok: false, message: "נדרשת הגדרת הצפנה בשרת לפני חיבור החשבון." };
  try {
    const apiKey: string = credential(form.get("apiKey"));
    const secretKey: string = credential(form.get("secretKey"));
    await verifyPayplus(apiKey, secretKey);
    const { error } = await supabase.from("integration_connections").upsert({ user_id: userId, provider: "payplus", account_label: "חשבון PayPlus", encrypted_credentials: seal(JSON.stringify({ apiKey, secretKey }), `${userId}:payplus`), connected_at: new Date().toISOString() });
    if (error) return { ok: false, message: "הפרטים נבדקו אך לא נשמרו. נסי שוב." };
    revalidatePath(path);
    return { ok: true, message: "חשבון PayPlus חובר ונבדקה הרשאת הקריאה למסמכים." };
  } catch { return { ok: false, message: "החיבור לא הצליח. בדקי את שני המפתחות ואת הרשאת הקריאה למסמכים ב־PayPlus, ונסי שוב." }; }
}

export async function startGmailConnection(): Promise<void> {
  const { userId } = await userContext();
  let destination: string;
  try {
    const attempt = newOAuthAttempt(userId);
    destination = authorizationUrl(attempt);
    const jar = await cookies();
    jar.set(OAUTH_COOKIE, seal(JSON.stringify(attempt), `${userId}:gmail-oauth`), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: COOKIE_PATH, maxAge: 600 });
  } catch { redirect(`${path}?connection=setup`); }
  redirect(destination);
}

export async function disconnectIntegration(provider: "gmail" | "payplus"): Promise<ConnectionResult> {
  if (provider !== "gmail" && provider !== "payplus") return { ok: false, message: "החיבור אינו מוכר." };
  const { supabase, userId } = await userContext();
  const { data, error: readError } = await supabase.from("integration_connections").select("encrypted_credentials").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (readError) return { ok: false, message: "לא ניתן לטעון את החיבור. נסי שוב." };
  const { error } = await supabase.from("integration_connections").delete().eq("user_id", userId).eq("provider", provider);
  if (error) return { ok: false, message: "הניתוק לא הושלם. נסי שוב." };
  let revoked: boolean = true;
  if (provider === "gmail") {
    const jar = await cookies();
    jar.set(OAUTH_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
    if (data) {
      try {
        const secret = record(JSON.parse(unseal(data.encrypted_credentials, `${userId}:gmail`)));
        revoked = typeof secret.refreshToken === "string" && await revokeGoogle(secret.refreshToken);
      } catch { revoked = false; }
    }
  }
  revalidatePath(path);
  return { ok: true, message: revoked ? "החשבון נותק. מסמכים שכבר יובאו נשארים במערכת." : "החשבון נותק מהמערכת. יש להסיר גם את הרשאת האפליקציה בחשבון Google, תחת אבטחה וחיבורים לאפליקציות." };
}
