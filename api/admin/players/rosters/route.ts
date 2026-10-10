import { NextResponse } from "next/server";
import { getMatchups, getRosters, getStandings } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";

export const dynamic = "force-dynamic";

const POSITION_ORDER: Record<string, number> = { C: 0, LW: 1, RW: 2, D: 3, G: 4 };

// Every fantasy team with its players, for the Player Cards dropdowns, plus the
// latest completed week (the default week for weekly cards).
export async function GET() {
  const [{ rosters, live }, { teams }, all] = await Promise.all([getRosters(), getStandings(), getMatchups()]);
  const latest = regularSeasonFinals(all.matchups).reduce((max, m) => Math.max(max, m.week), 0);

  const out = rosters
    .map((r) => ({
      id: r.teamId,
      name: teams.find((t) => t.id === r.teamId)?.name ?? `Team ${r.teamId}`,
      players: r.players
        .map((p) => ({ id: p.id, name: p.name, position: p.position }))
        .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ live, defaultWeek: latest || 1, teams: out });
}
