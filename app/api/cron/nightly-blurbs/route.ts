import { NextResponse } from "next/server";
import { runNightly } from "@/lib/nightly-run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Called once a day by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET environment
// variable is set, so nobody else can trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set in Vercel." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNightly({ save: true });
  return NextResponse.json({
    ok: result.ok,
    saved: result.saved,
    period: result.period,
    date: result.date,
    published: result.scan?.blurbs.length ?? 0,
    error: result.error,
  });
}
