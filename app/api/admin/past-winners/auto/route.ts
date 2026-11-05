import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { generateSeasonWinners, seasonsToGenerate } from "@/lib/auto-winners";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only. GET lists the seasons that still need automatic winners (?all=1 for every season);
// POST {season} works out and saves that one season (one season per call keeps ESPN reads small).
export async function GET(req: NextRequest) {
  try {
    const meta = await getLeagueMeta();
    return NextResponse.json({ seasons: await seasonsToGenerate(meta.season, req.nextUrl.searchParams.get("all") === "1") });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const season = Number(body.season);
    if (!Number.isInteger(season) || season < 2000 || season > 2100) return NextResponse.json({ error: "Bad season." }, { status: 400 });
    return NextResponse.json(await generateSeasonWinners(season));
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}
