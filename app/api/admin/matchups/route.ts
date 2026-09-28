import { NextRequest, NextResponse } from "next/server";
import { getMatchups, getStandings } from "@/lib/espn";
import { getMatchupContent, upsertMatchupContent } from "@/lib/content";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }

  const [{ matchups }, { teams }, content] = await Promise.all([
    getMatchups(week),
    getStandings(),
    getMatchupContent(season, week),
  ]);

  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;

  const merged = matchups.map((m) => {
    const existing = content.find((c) => c.homeTeamId === m.homeTeamId && c.awayTeamId === m.awayTeamId);
    return {
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeamName: teamName(m.homeTeamId),
      awayTeamName: teamName(m.awayTeamId),
      preview: existing?.preview ?? "",
      summary: existing?.summary ?? "",
    };
  });

  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { season, week, homeTeamId, awayTeamId, preview, summary } = body;

  if (!season || !week || !homeTeamId || !awayTeamId) {
    return NextResponse.json({ error: "season, week, homeTeamId, awayTeamId are required" }, { status: 400 });
  }

  await upsertMatchupContent(season, week, homeTeamId, awayTeamId, preview || null, summary || null);
  return NextResponse.json({ ok: true });
}
