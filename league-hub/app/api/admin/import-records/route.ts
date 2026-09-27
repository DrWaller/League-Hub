import { NextRequest, NextResponse } from "next/server";
import { getHistoricalSeasonTeams } from "@/lib/espn";
import { upsertHistoricalRecord } from "@/lib/content";

// Imports real W-L records from ESPN for one season, per team. Creates or
// updates the manager_team_seasons row's record fields + ESPN-sourced team
// name; never touches manager assignment or record_note. Run this BEFORE
// assigning managers to a season -- assignment is a separate, safe step.
export async function POST(req: NextRequest) {
  const { season } = await req.json();
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });

  const result = await getHistoricalSeasonTeams(season);
  if (!result.ok || !result.teams) {
    return NextResponse.json({ error: result.error || "Failed to fetch from ESPN" }, { status: 502 });
  }

  const imported = [];
  for (const t of result.teams) {
    await upsertHistoricalRecord(t.id, season, t.name, t.wins, t.losses, t.ties, t.pointsFor, t.pointsAgainst);
    imported.push({ teamId: t.id, teamName: t.name, wins: t.wins, losses: t.losses, ties: t.ties });
  }

  return NextResponse.json({ ok: true, imported });
}
