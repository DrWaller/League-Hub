// Simple single-password gate for /admin. Not meant for multiple accounts
// or sensitive data -- just enough to keep the editing tools away from
// random visitors. The password lives in the ADMIN_PASSWORD environment
// variable (set in Vercel, same place as the ESPN cookies).

export const ADMIN_COOKIE = "league_admin_auth";

export function isValidAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && password === expected;
}
