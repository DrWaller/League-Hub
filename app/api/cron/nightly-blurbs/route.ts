import { NextResponse } from "next/server";
import { catchUpNights, runNightly } from "@/lib/nightly-run";
import { runAutoAwards } from "@/lib/auto-awards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called once a day by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET environment
// variable is set, so nobody else can trigger it.
export async function GET(req: Request) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set in Vercel." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Heal any night missed in the last 2 days first, then save last night.
  await catchUpNights(2);
  const result = await runNightly({ save: true });

  // Then save the weekly / monthly awards for anything that has just become final (Vercel Hobby only allows two
  // cron jobs, so this rides along on the daily run). Best effort: a problem here never affects the blurbs above.
  const awards = await runAutoAwards({ outOfTime: () => Date.now() - started > 35000 }).catch((e) => ({
    ok: false,
    error: e instanceof Error ? e.message : String(e),
  }));

  return NextResponse.json({
    ok: result.ok,
    saved: result.saved,
    period: result.period,
    date: result.date,
    published: result.scan?.blurbs.length ?? 0,
    error: result.error,
    awards,
  });
}
