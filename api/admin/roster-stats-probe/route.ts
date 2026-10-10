import { NextRequest, NextResponse } from "next/server";
import { diagnoseRosterStats } from "@/lib/espn";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!season || !week) return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  return NextResponse.json(await diagnoseRosterStats(season, week));
}
