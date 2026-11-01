import { NextRequest, NextResponse } from "next/server";
import { suggestMonthlyAwards } from "@/lib/award-suggest";

// Suggests monthly award picks from real stats. The same picks are saved automatically each night
// once every week in a month is final -- see lib/auto-awards.ts.
export async function GET(req: NextRequest) {
  const startWeek = Number(req.nextUrl.searchParams.get("startWeek"));
  const endWeek = Number(req.nextUrl.searchParams.get("endWeek"));
  if (!startWeek || !endWeek) {
    return NextResponse.json({ error: "startWeek and endWeek are required" }, { status: 400 });
  }
  return NextResponse.json(await suggestMonthlyAwards(startWeek, endWeek));
}
