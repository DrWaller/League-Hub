import { NextRequest, NextResponse } from "next/server";
import { probeDailySeason } from "@/lib/espn-daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Commissioner-only diagnostic: does ESPN return day-by-day lineups for a past season?
//   /api/admin/daily-probe?season=2024                  probes a spread of scoring days across the season
//   /api/admin/daily-probe?season=2024&periods=30,31    probes exactly those days
// Read "days": playersWithDayStats > 0 and sensible teamTotals means that day is recoverable.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const season = Number(q.get("season"));
  if (!season) return NextResponse.json({ error: "season is required, e.g. ?season=2024" }, { status: 400 });
  const periods = (q.get("periods") ?? "5,20,40,70,100,140")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 12);
  return NextResponse.json(await probeDailySeason(season, periods));
}
