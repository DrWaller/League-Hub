import { NextRequest, NextResponse } from "next/server";
import { getWeeklyAwards, upsertWeeklyAward } from "@/lib/content";
import { AwardCategory } from "@/lib/types";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }
  const awards = await getWeeklyAwards(season, week);
  return NextResponse.json(awards);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { season, week, entries } = body as {
    season: number;
    week: number;
    entries: { category: AwardCategory; playerName: string; teamId: number | null; note: string | null }[];
  };

  if (!season || !week || !Array.isArray(entries)) {
    return NextResponse.json({ error: "season, week, and entries are required" }, { status: 400 });
  }

  for (const entry of entries) {
    if (!entry.playerName?.trim()) continue; // skip blanks -- nothing to save for that category yet
    await upsertWeeklyAward(season, week, entry.category, entry.playerName.trim(), entry.teamId, entry.note || null);
  }

  return NextResponse.json({ ok: true });
}
