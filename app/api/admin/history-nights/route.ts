import { NextRequest, NextResponse } from "next/server";
import { backfillPastSeason } from "@/lib/nightly-past";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Commissioner-only. Reads one past season's days from ESPN for a bit under a minute and reports progress;
// the admin page calls it again until nothing remains.   /api/admin/history-nights?season=2024
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  return NextResponse.json(await backfillPastSeason(season, 40000, 3));
}
