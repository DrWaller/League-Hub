import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

// Protects everything under /admin except the login page itself and the
// login API route (which needs to be reachable to set the cookie).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isExempt =
    pathname === "/admin/login" || pathname === "/api/admin/login";

  if (!isExempt) {
    const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
    const expected = process.env.ADMIN_PASSWORD;
    if (!cookie || !expected || cookie !== expected) {
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
