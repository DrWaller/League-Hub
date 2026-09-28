import { NextRequest, NextResponse } from "next/server";
import { getMonthlyAwards, upsertMonthlyAward } from "@/lib/content";
import { AwardCategory } from "@/lib/types";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const periodLabel = req.nextUrl.searchParams.get("periodLabel");
  if (!season || !periodLabel) {
    return NextResponse.json({ error: "season and periodLabel are required" }, { status: 400 });
  }
  const awards = await getMonthlyAwards(season, periodLabel);
  return NextResponse.json(awards);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { season, periodLabel, entries } = body as {
    season: number;
    periodLabel: string;
    entries: { category: AwardCategory; playerName: string; teamId: number | null; note: string | null }[];
  };

  if (!season || !periodLabel || !Array.isArray(entries)) {
    return NextResponse.json({ error: "season, periodLabel, and entries are required" }, { status: 400 });
  }

  for (const entry of entries) {
    if (!entry.playerName?.trim()) continue;
    await upsertMonthlyAward(season, periodLabel, entry.category, entry.playerName.trim(), entry.teamId, entry.note || null);
  }

  return NextResponse.json({ ok: true });
}
