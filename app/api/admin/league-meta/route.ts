import { NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";

export const dynamic = "force-dynamic";

// The current season and matchup week, so the Graphics page can open on them.
export async function GET() {
  const meta = await getLeagueMeta();
  return NextResponse.json({ season: meta.season, week: meta.currentWeek, live: meta.liveDataConnected });
}
