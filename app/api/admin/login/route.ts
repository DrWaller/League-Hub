import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, createAdminSession, isValidAdminPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!(await isValidAdminPassword(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const session = await createAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ADMIN_PASSWORD isn't set on the server." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  // The cookie holds a signed, expiring token -- never the password itself.
  res.cookies.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return res;
}
