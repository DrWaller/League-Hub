// Server-side only. "What if both managers had played a perfect lineup every night?"
// Pairs each matchup's two best-possible-lineup totals (saved in lineup_weekly by lib/lineup-store.ts) and
// compares the outcome with what really happened.

import { syncSeasonLineups, getStoredLineups, type StoredLineupWeek } from "@/lib/lineup-store";
import type { Matchup } from "@/lib/types";

export type Outcome = "home" | "away" | "tie";

// Scores are compared at two decimals (the league's precision) so float noise never makes a fake winner.
const cents = (n: number) => Math.round(n * 100);

export function outcomeOf(home: number, away: number): Outcome {
  const h = cents(home);
  const a = cents(away);
  return h > a ? "home" : a > h ? "away" : "tie";
}

export interface OptimalMatchup {
  homeMax: number;
  awayMax: number;
  real: Outcome;
  optimal: Outcome;
  flipped: boolean; // the perfect-lineup result differs from the real one
}

// Best-lineup totals for one week, loading (and saving) the week from ESPN the first time it is needed.
export async function getOptimalForWeek(season: number, week: number): Promise<Map<number, number>> {
  let rows = (await getStoredLineups(season)).filter((r) => r.week === week);
  if (rows.length === 0) {
    await syncSeasonLineups(season, [week], 1).catch(() => null);
    rows = (await getStoredLineups(season)).filter((r) => r.week === week);
  }
  return new Map(rows.map((r) => [r.teamId, r.max]));
}

export function optimalMatchup(m: Matchup, maxByTeam: Map<number, number>): OptimalMatchup | null {
  const homeMax = maxByTeam.get(m.homeTeamId);
  const awayMax = maxByTeam.get(m.awayTeamId);
  if (homeMax == null || awayMax == null) return null;
  // A perfect lineup can never score less than the real one.
  const hm = Math.max(homeMax, m.homeScore);
  const am = Math.max(awayMax, m.awayScore);
  const real = outcomeOf(m.homeScore, m.awayScore);
  const optimal = outcomeOf(hm, am);
  return { homeMax: hm, awayMax: am, real, optimal, flipped: real !== optimal };
}

export interface Record3 {
  w: number;
  l: number;
  t: number;
}

export interface OptimalRecordRow {
  teamId: number;
  actual: Record3;
  optimal: Record3;
  winsLost: number; // real wins that would not be wins if both sides played perfectly
  lossesSaved: number; // real losses/ties that would be wins if both sides played perfectly
  flipped: number; // total results that change
  games: number;
}

// Season tally over finished regular-season matchups that have saved lineup data.
// winsLost  = games the manager really won but would not have won if BOTH sides played perfectly.
// lossesSaved = games the manager really lost/tied but would have won with perfect lineups on both sides.
export function summarizeOptimalRecords(finals: Matchup[], rows: StoredLineupWeek[]): { teams: OptimalRecordRow[]; games: number } {
  const maxBy = new Map<string, number>();
  for (const r of rows) maxBy.set(`${r.week}:${r.teamId}`, r.max);
  const by = new Map<number, OptimalRecordRow>();
  const get = (id: number) => {
    let t = by.get(id);
    if (!t) {
      t = { teamId: id, actual: { w: 0, l: 0, t: 0 }, optimal: { w: 0, l: 0, t: 0 }, winsLost: 0, lossesSaved: 0, flipped: 0, games: 0 };
      by.set(id, t);
    }
    return t;
  };
  let games = 0;
  for (const m of finals) {
    const hm = maxBy.get(`${m.week}:${m.homeTeamId}`);
    const am = maxBy.get(`${m.week}:${m.awayTeamId}`);
    if (hm == null || am == null) continue;
    games++;
    const real = outcomeOf(m.homeScore, m.awayScore);
    const opt = outcomeOf(Math.max(hm, m.homeScore), Math.max(am, m.awayScore));
    for (const side of ["home", "away"] as const) {
      const t = get(side === "home" ? m.homeTeamId : m.awayTeamId);
      const res = (o: Outcome) => (o === "tie" ? "t" : o === side ? "w" : "l");
      const r = res(real);
      const o = res(opt);
      t.actual[r]++;
      t.optimal[o]++;
      t.games++;
      if (r !== o) t.flipped++;
      if (r === "w" && o !== "w") t.winsLost++;
      if (r !== "w" && o === "w") t.lossesSaved++;
    }
  }
  const teams = [...by.values()].sort(
    (a, b) => b.optimal.w - a.optimal.w || a.optimal.l - b.optimal.l || b.actual.w - a.actual.w
  );
  return { teams, games };
}
