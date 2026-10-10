import { NextRequest, NextResponse } from "next/server";
import {
  getManualSeasons,
  getManualSeasonData,
  replaceManualSeason,
  setManualTeamManager,
  deleteManualSeason,
  getPlayedElsewhereSeasons,
} from "@/lib/content";
import { parseScores } from "@/lib/manual-season";

// Seasons played on another platform (Fantrax), entered by hand.
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!season) return NextResponse.json({ seasons: await getManualSeasons() });
  const [data, elsewhere] = await Promise.all([getManualSeasonData(season), getPlayedElsewhereSeasons()]);
  return NextResponse.json({
    teams: data.teams,
    games: data.matchups.length,
    weeks: new Set(data.matchups.map((m) => m.week)).size,
    taggedFantrax: elsewhere.has(season),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "assign") {
    const teamId = Number(body.teamId);
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    await setManualTeamManager(teamId, body.managerId ? Number(body.managerId) : null);
    return NextResponse.json({ ok: true });
  }

  // default: import a pasted block of scores for one season
  const season = Number(body.season);
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  // Refuse unless the season is tagged: otherwise the site would still show
  // ESPN's data for it and this hand-entered data would be ignored.
  if (!(await getPlayedElsewhereSeasons()).has(season)) {
    return NextResponse.json(
      { error: `Tag ${season} "Played on Fantrax" on the League History admin page first, so ESPN's data for it is switched off.` },
      { status: 400 }
    );
  }
  const parsed = parseScores(String(body.csv ?? ""));
  if (parsed.errors.length) return NextResponse.json({ error: "There are problems with the pasted scores.", errors: parsed.errors }, { status: 400 });
  await replaceManualSeason(season, parsed.games);
  return NextResponse.json({ ok: true, games: parsed.games.length, teams: parsed.teams.length, warnings: parsed.warnings });
}

export async function DELETE(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  await deleteManualSeason(season);
  return NextResponse.json({ ok: true });
}
