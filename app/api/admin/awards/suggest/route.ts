import { NextRequest, NextResponse } from "next/server";
import { suggestWeeklyAwards } from "@/lib/award-suggest";

// Suggests award picks from real weekly stats -- pure computation, no AI,
// no extra cost. The admin still reviews/edits before saving anything.
// (The same picks are saved automatically each night once a week is final -- see lib/auto-awards.ts.)
export async function GET(req: NextRequest) {
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!week) {
    return NextResponse.json({ error: "week is required" }, { status: 400 });
  }
  return NextResponse.json(await suggestWeeklyAwards(week));
}
