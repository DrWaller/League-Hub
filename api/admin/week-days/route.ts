import { NextRequest, NextResponse } from "next/server";
import { getCalendarFacts, getLeagueMeta } from "@/lib/espn";
import { getWeekCalendar, saveWeekCalendar } from "@/lib/week-calendar";

export const dynamic = "force-dynamic";

// GET ?season=N (default: current) -> saved calendar + facts from ESPN to pre-fill the editor
export async function GET(req: NextRequest) {
  const meta = await getLeagueMeta();
  const season = Number(req.nextUrl.searchParams.get("season")) || meta.season;
  const [saved, facts] = await Promise.all([getWeekCalendar(season), getCalendarFacts(season === meta.season ? undefined : season)]);
  return NextResponse.json({ season, saved, facts });
}

// POST { season, startDate, lengths: number[] }
export async function POST(req: NextRequest) {
  const { season, startDate, lengths } = await req.json();
  const clean = Array.isArray(lengths) ? lengths.map((n: unknown) => Math.round(Number(n))) : [];
  if (!Number(season) || clean.length === 0 || clean.some((n) => !Number.isFinite(n) || n < 1 || n > 31)) {
    return NextResponse.json({ error: "Every week needs a length between 1 and 31 days." }, { status: 400 });
  }
  const date = typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
  await saveWeekCalendar(Number(season), { startDate: date, lengths: clean });
  return NextResponse.json({ ok: true });
}
