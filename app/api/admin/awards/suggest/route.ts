import { NextRequest, NextResponse } from "next/server";
import { getWeeklyPlayerStats, getLeagueMeta } from "@/lib/espn";
import { getWeekVor } from "@/lib/vor";

// Suggests award picks from real weekly stats -- pure computation, no AI,
// no extra cost. The admin still reviews/edits before saving anything.

// Best by value over replacement when the players carry it, else by raw points.
type Ranked = { name: string; position: string; teamId: number; points: number; vor?: number };
function top(players: Ranked[], n: number) {
  return [...players].sort((a, b) => (b.vor ?? b.points) - (a.vor ?? a.points) || b.points - a.points).slice(0, n);
}

export async function GET(req: NextRequest) {
  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!week) {
    return NextResponse.json({ error: "week is required" }, { status: 400 });
  }

  const { players, live } = await getWeeklyPlayerStats(week);

  if (!live || players.length === 0) {
    return NextResponse.json({
      live,
      suggestions: null,
      message: live
        ? "No stats posted for this week yet."
        : "ESPN isn't connected, so there's no real stat data to suggest from.",
    });
  }

  // The 3 Stars are the most valuable players over replacement, so a goalie and a forward compete
  // fairly. If VOR can't be worked out, fall back to raw points.
  const meta = await getLeagueMeta();
  const vor = await getWeekVor(week, meta.season, meta.season).catch(() => null);
  const [star1, star2, star3] = vor ? vor.players.slice(0, 3) : top(players, 3);
  const ranked: Ranked[] = vor ? vor.players : players;
  const forwards = ranked.filter((p) => ["C", "LW", "RW"].includes(p.position));
  const defense = ranked.filter((p) => p.position === "D");
  const goalies = ranked.filter((p) => p.position === "G");
  const [fwd1, fwd2] = top(forwards, 2);
  const [def1, def2] = top(defense, 2);
  const [g1, g2] = top(goalies, 2);

  const toEntry = (p?: { name: string; teamId: number; points: number; vor?: number }) =>
    p ? { playerName: p.name, teamId: p.teamId, points: p.points, vor: p.vor } : null;

  return NextResponse.json({
    live,
    suggestions: {
      star1: toEntry(star1),
      star2: toEntry(star2),
      star3: toEntry(star3),
      forward: toEntry(fwd1),
      forward_runner_up: toEntry(fwd2),
      defense: toEntry(def1),
      defense_runner_up: toEntry(def2),
      goalie: toEntry(g1),
      goalie_runner_up: toEntry(g2),
    },
  });
}
