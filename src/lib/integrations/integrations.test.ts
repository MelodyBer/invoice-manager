import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { seal, unseal, newOAuthAttempt, validateAttempt, parseNames, encryptionReady } from "./security";
import { authorizationUrl, connectGoogle, googleConfig, verifyPayplus, revokeGoogle, GMAIL_SCOPE } from "./providers";

beforeEach(() => {
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "ab".repeat(32));
  vi.stubEnv("INTEGRATIONS_APP_URL", "https://app.example.com");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function reply(value: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("integration secret isolation", () => {
  it("roundtrips credentials without storing plaintext and randomizes encryption", () => {
    const first: string = seal("private-token", "user-a:gmail");
    expect(first).not.toContain("private-token");
    expect(seal("private-token", "user-a:gmail")).not.toBe(first);
    expect(unseal(first, "user-a:gmail")).toBe("private-token");
  });
  it("rejects another owner or provider", () => {
    const secret: string = seal("token", "user-a:gmail");
    expect(() => unseal(secret, "user-b:gmail")).toThrow();
    expect(() => unseal(secret, "user-a:payplus")).toThrow();
  });
  it("rejects modified ciphertext", () => {
    const parts: string[] = seal("token", "user-a:gmail").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => unseal(parts.join("."), "user-a:gmail")).toThrow();
  });
  it("does not fall back to another secret", () => {
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "");
    expect(encryptionReady()).toBe(false);
    expect(() => seal("token", "user-a:gmail")).toThrow();
  });
});

describe("OAuth binding", () => {
  it("accepts only the initiating user and matching state within ten minutes", () => {
    const attempt = newOAuthAttempt("user-a");
    const secret: string = seal(JSON.stringify(attempt), "user-a:gmail-oauth");
    expect(validateAttempt(secret, "user-a", attempt.state)).toEqual(attempt);
    expect(() => validateAttempt(secret, "user-b", attempt.state)).toThrow();
    expect(() => validateAttempt(secret, "user-a", "other-state")).toThrow();
    expect(() => validateAttempt(secret, "user-a", attempt.state, attempt.issuedAt + 600001)).toThrow();
  });
  it("requests read-only access with PKCE and a fixed redirect", () => {
    const attempt = newOAuthAttempt("user-a");
    const url = new URL(authorizationUrl(attempt));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/gmail/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.toString()).not.toContain(attempt.verifier);
    expect(url.toString()).not.toContain("test-secret");
  });
  it("rejects insecure public origins and origins with paths", () => {
    vi.stubEnv("INTEGRATIONS_APP_URL", "http://app.example.com");
    expect(() => googleConfig()).toThrow();
    vi.stubEnv("INTEGRATIONS_APP_URL", "https://app.example.com/unexpected");
    expect(() => googleConfig()).toThrow();
  });
});

describe("user-entered recognition settings", () => {
  it("leaves settings empty and accepts a chosen first name without presets", () => {
    expect(parseNames("")).toEqual([]);
    expect(parseNames("  דנה  ")).toEqual(["דנה"]);
    expect(parseNames("דנה\nDana\nדנה")).toEqual(["דנה", "Dana"]);
  });
  it("rejects excessive entries and control characters", () => {
    expect(() => parseNames(Array.from({ length: 21 }, (_, index: number) => `שם ${index}`).join("\n"))).toThrow();
    expect(() => parseNames("שם\u0000")).toThrow();
  });
});

describe("provider connections", () => {
  it("verifies PayPlus through the read-only document endpoint", async () => {
    const request = vi.fn().mockResolvedValue(reply({ results: { status: "success" }, data: [] }));
    vi.stubGlobal("fetch", request);
    await verifyPayplus("test-key", "test-secret");
    expect(request).toHaveBeenCalledWith("https://restapi.payplus.co.il/api/v1.0/books/docs/list?skip=0&take=1", expect.objectContaining({ redirect: "error", cache: "no-store", headers: { "api-key": "test-key", "secret-key": "test-secret" } }));
  });
  it("does not treat HTTP 200 with a failure payload as connected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ results: { status: "error" } })));
    await expect(verifyPayplus("test-key", "test-secret")).rejects.toThrow();
  });
  it("never exposes provider error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ secret: "sensitive-provider-message" }, 401)));
    await expect(verifyPayplus("test-key", "test-secret")).rejects.not.toThrow("sensitive-provider-message");
  });
  it("connects Gmail only with durable read permission and confirms mailbox identity", async () => {
    const request = vi.fn().mockResolvedValueOnce(reply({ refresh_token: "refresh", access_token: "access", scope: GMAIL_SCOPE })).mockResolvedValueOnce(reply({ emailAddress: "test@example.com" }));
    vi.stubGlobal("fetch", request);
    await expect(connectGoogle("code", "verifier")).resolves.toEqual({ email: "test@example.com", refreshToken: "refresh" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].body.toString()).toContain("code_verifier=verifier");
  });
  it("rejects a Gmail grant without refresh token or required scope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ access_token: "access", scope: GMAIL_SCOPE })));
    await expect(connectGoogle("code", "verifier")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ access_token: "access", refresh_token: "refresh", scope: "unrelated" })));
    await expect(connectGoogle("code", "verifier")).rejects.toThrow();
  });
  it("reports revocation failures so the user can revoke Google access manually", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(revokeGoogle("refresh")).resolves.toBe(false);
  });
});
