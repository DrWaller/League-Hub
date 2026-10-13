import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { AWARD_DEFS, loadHallOfFame, saveSeasonWinners } from "@/lib/hall-of-fame";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only. GET returns every season's winners; POST {season, winners:{award: name}} saves one season's edits.
export async function GET() {
  try {
    const meta = await getLeagueMeta();
    return NextResponse.json({ awards: AWARD_DEFS, seasons: await loadHallOfFame(meta.season) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const season = Number(body.season);
    if (!Number.isInteger(season) || season < 2000 || season > 2100) return NextResponse.json({ error: "Bad season." }, { status: 400 });
    await saveSeasonWinners(season, body.winners ?? {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}
