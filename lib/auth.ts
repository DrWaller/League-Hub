// Simple single-password gate for /admin. Not meant for multiple accounts
// or sensitive data -- just enough to keep the editing tools away from
// random visitors. The password lives in the ADMIN_PASSWORD environment
// variable (set in Vercel, same place as the ESPN cookies).
//
// The browser cookie never contains the password. On login it gets a signed
// session token ("<expiry>.<HMAC>") instead, so someone who reads the cookie
// (shared computer, extension, screenshot of dev tools) learns nothing they
// can reuse after it expires, and cannot recover the password from it.
//
// Uses the Web Crypto API (globalThis.crypto.subtle) rather than Node's
// `crypto` module because middleware.ts runs on the Edge runtime, where
// Node's module isn't available. Both runtimes share this one file.
//
// Optional: set ADMIN_SESSION_SECRET (any long random string) in Vercel. It is
// mixed into the signing key, which makes offline guessing of a weak password
// from a stolen cookie infeasible. Changing either ADMIN_PASSWORD or
// ADMIN_SESSION_SECRET logs every existing session out.

export const ADMIN_COOKIE = "league_admin_auth";
export const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

// Compares without bailing out at the first differing character.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function signingKey(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return `${process.env.ADMIN_SESSION_SECRET ?? ""}\u0000${password}`;
}

export async function isValidAdminPassword(candidate: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  // Hash both sides first so the comparison is always over equal-length
  // strings, whatever was typed.
  const [a, b] = await Promise.all([
    hmacHex("league-admin-password-check", candidate),
    hmacHex("league-admin-password-check", expected),
  ]);
  return safeEqual(a, b);
}

// The value to put in the cookie after a successful login.
export async function createAdminSession(): Promise<string | null> {
  const key = signingKey();
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await hmacHex(key, `admin-session:${expires}`);
  return `${expires}.${sig}`;
}

export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  const key = signingKey();
  if (!key || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(key, `admin-session:${expires}`);
  return safeEqual(expected, token.slice(dot + 1));
}
