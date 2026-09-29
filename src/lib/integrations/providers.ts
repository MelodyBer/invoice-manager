import "server-only";
import { challenge, record, type OAuthAttempt } from "./security";

export const GMAIL_SCOPE: string = "https://www.googleapis.com/auth/gmail.readonly";
export const OAUTH_COOKIE: string = "invoice_gmail_connection";
export const COOKIE_PATH: string = "/api/integrations/gmail";

export function googleConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId: string = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret: string = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const origin = new URL(process.env.INTEGRATIONS_APP_URL ?? "http://invalid.invalid");
  if (!clientId || !clientSecret || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) || origin.hostname === "invalid.invalid") throw new Error("נדרשת הגדרה חד־פעמית של חיבור Google בשרת.");
  return { clientId, clientSecret, redirectUri: `${origin.origin}/api/integrations/gmail/callback` };
}

export function googleReady(): boolean {
  try { googleConfig(); return true; } catch { return false; }
}

export function authorizationUrl(attempt: OAuthAttempt): string {
  const config = googleConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent select_account", state: attempt.state, code_challenge: challenge(attempt.verifier), code_challenge_method: "S256" }).toString();
  return url.toString();
}

async function jsonRequest(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response: Response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("החיבור לשירות לא הצליח. בדקי את ההרשאות ונסי שוב.");
  return record(await response.json());
}

export async function connectGoogle(code: string, verifier: string): Promise<{ email: string; refreshToken: string }> {
  const config = googleConfig();
  const token = await jsonRequest("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, code_verifier: verifier, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }) });
  if (typeof token.refresh_token !== "string" || typeof token.access_token !== "string" || typeof token.scope !== "string" || !token.scope.split(" ").includes(GMAIL_SCOPE)) throw new Error("נדרשת הרשאה לקריאת המייל. חברי מחדש ואשרי אותה.");
  const profile = await jsonRequest("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (typeof profile.emailAddress !== "string") throw new Error("לא ניתן לזהות את חשבון המייל.");
  return { email: profile.emailAddress, refreshToken: token.refresh_token };
}

export function credential(value: unknown): string {
  if (typeof value !== "string" || !/^[\x21-\x7e]{8,512}$/.test(value.trim())) throw new Error("פרטי החיבור אינם תקינים. העתיקי שוב מהממשק של השירות.");
  return value.trim();
}

export async function verifyPayplus(apiKey: string, secretKey: string): Promise<void> {
  const result = await jsonRequest("https://restapi.payplus.co.il/api/v1.0/books/docs/list?skip=0&take=1", { headers: { "api-key": apiKey, "secret-key": secretKey } });
  const status = record(result.results);
  if (status.status !== "success") throw new Error("לא ניתן לקרוא מסמכים בחשבון PayPlus. בדקי שהמפתחות והרשאת המסמכים פעילים.");
}

export async function revokeGoogle(refreshToken: string): Promise<boolean> {
  try {
    const response: Response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }), redirect: "error", signal: AbortSignal.timeout(10_000), cache: "no-store" });
    return response.ok;
  } catch { return false; }
}
