import { NextRequest, NextResponse } from "next/server";
import { getMonthlyPlayerStats, getLeagueMeta } from "@/lib/espn";
import { getPeriodVor } from "@/lib/vor";

// Best by value over replacement when the players carry it, else by raw points.
type Ranked = { name: string; position: string; teamId: number; points: number; vor?: number };
function top(players: Ranked[], n: number) {
  return [...players].sort((a, b) => (b.vor ?? b.points) - (a.vor ?? a.points) || b.points - a.points).slice(0, n);
}

export async function GET(req: NextRequest) {
  const startWeek = Number(req.nextUrl.searchParams.get("startWeek"));
  const endWeek = Number(req.nextUrl.searchParams.get("endWeek"));
  if (!startWeek || !endWeek) {
    return NextResponse.json({ error: "startWeek and endWeek are required" }, { status: 400 });
  }

  const { players, live } = await getMonthlyPlayerStats(startWeek, endWeek);

  if (!live || players.length === 0) {
    return NextResponse.json({
      live,
      suggestions: null,
      message: live ? "No stats posted for this range yet." : "ESPN isn't connected.",
    });
  }

  // 3 Stars of the Month: most total value over replacement across the weeks (fallback: raw points).
  const meta = await getLeagueMeta();
  const vor = await getPeriodVor(startWeek, endWeek, meta.season, meta.season).catch(() => null);
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
