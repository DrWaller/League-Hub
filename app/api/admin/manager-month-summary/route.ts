import { NextRequest, NextResponse } from "next/server";
import { getManagerMonthSummary, getStandings } from "@/lib/espn";
import { getManagerSeasons, getManagers } from "@/lib/content";

// Auto-computes "Manager of the Month" -- an objective fact from real
// matchup results, not an editorial pick, so there's nothing to curate
// or save here. Merges in manager names where a manager-season row for
// that team/season already exists.
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const startWeek = Number(req.nextUrl.searchParams.get("startWeek"));
  const endWeek = Number(req.nextUrl.searchParams.get("endWeek"));
  if (!season || !startWeek || !endWeek) {
    return NextResponse.json({ error: "season, startWeek, and endWeek are required" }, { status: 400 });
  }

  const [{ teams: summaries, live }, { teams: liveTeams }, managerSeasons, managers] = await Promise.all([
    getManagerMonthSummary(startWeek, endWeek, season),
    getStandings(),
    getManagerSeasons(),
    getManagers(),
  ]);

  const teamName = (teamId: number) => liveTeams.find((t) => t.id === teamId)?.name ?? `Team ${teamId}`;
  const managerNameForTeam = (teamId: number) => {
    const ms = managerSeasons.find((s) => s.teamId === teamId && s.season === season);
    if (!ms?.managerId) return null;
    return managers.find((m) => m.id === ms.managerId)?.name ?? null;
  };

  const ranked = [...summaries].sort(
    (a, b) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor
  );

  return NextResponse.json({
    live,
    teams: ranked.map((s) => ({ ...s, teamName: teamName(s.teamId), managerName: managerNameForTeam(s.teamId) })),
  });
}
