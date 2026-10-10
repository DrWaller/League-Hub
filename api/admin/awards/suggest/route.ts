import { NextRequest, NextResponse } from "next/server";
import { getWeeklyPlayerStats } from "@/lib/espn";
import { WeeklyPlayerStat } from "@/lib/types";

// Suggests award picks from real weekly stats -- pure computation, no AI,
// no extra cost. The admin still reviews/edits before saving anything.

function top(players: WeeklyPlayerStat[], n: number) {
  return [...players].sort((a, b) => b.points - a.points).slice(0, n);
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

  const forwards = players.filter((p) => ["C", "LW", "RW"].includes(p.position));
  const defense = players.filter((p) => p.position === "D");
  const goalies = players.filter((p) => p.position === "G");

  const [star1, star2, star3] = top(players, 3);
  const [fwd1, fwd2] = top(forwards, 2);
  const [def1, def2] = top(defense, 2);
  const [g1, g2] = top(goalies, 2);

  const toEntry = (p?: WeeklyPlayerStat) =>
    p ? { playerName: p.name, teamId: p.teamId, points: p.points } : null;

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
