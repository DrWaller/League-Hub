import { NextRequest, NextResponse } from "next/server";
import { getHistoricalSeasonTeams } from "@/lib/espn";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  const result = await getHistoricalSeasonTeams(season);
  return NextResponse.json(result);
}
