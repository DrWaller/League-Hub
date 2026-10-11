import { NextResponse } from "next/server";
import { getLines } from "@/lib/lines";
import { syncLines } from "@/lib/lines-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called once a day by Vercel Cron (see vercel.json): saves the day's line combinations and records any
// changes since last time. The pickup page does the same whenever it's opened, so this is the backstop.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set in Vercel." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const lines = await getLines();
  if (!lines) return NextResponse.json({ ok: false, error: "Couldn't read any team's lines." }, { status: 502 });
  const changes = await syncLines(lines);
  return NextResponse.json({ ok: true, teams: lines.teamsOk.length, failed: lines.teamsFailed, changes });
}
