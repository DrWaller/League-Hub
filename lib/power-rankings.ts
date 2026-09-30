// A custom power-rankings model, separate from whatever ESPN shows.
// ESPN's built-in power rankings only look at recent matchup margins.
// This blends three signals so a team that's actually been outscoring
// the league (not just winning close ones) rises accordingly:
//
//   1. Win percentage       (are they winning matchups)
//   2. Point differential   (are they winning convincingly, per game)
//   3. Current streak       (are they trending up or down right now)
//
// Weights are deliberately in one place and easy to tune.

import { Team, PowerRankingEntry, Matchup } from "./types";
import { regularSeasonFinals } from "./luck";

const WEIGHTS = {
  winPct: 0.5,
  pointDiff: 0.35,
  streak: 0.15,
};

function zScores(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1; // avoid divide-by-zero in week 1
  return values.map((v) => (v - mean) / sd);
}

function streakValue(streak?: string): number {
  if (!streak) return 0;
  const type = streak[0];
  const length = Number(streak.slice(1)) || 0;
  const signed = type === "W" ? length : -length;
  return Math.max(-3, Math.min(3, signed)); // cap so one long streak can't dominate
}

export function calculatePowerRankings(teams: Team[]): PowerRankingEntry[] {
  const winPcts = teams.map((t) => {
    const games = t.wins + t.losses + t.ties;
    return games > 0 ? (t.wins + t.ties * 0.5) / games : 0;
  });

  const pointDiffsPerGame = teams.map((t) => {
    const games = t.wins + t.losses + t.ties;
    return games > 0 ? (t.pointsFor - t.pointsAgainst) / games : 0;
  });

  const streaks = teams.map((t) => streakValue(t.streak));

  const winZ = zScores(winPcts);
  const diffZ = zScores(pointDiffsPerGame);
  const streakZ = zScores(streaks);

  const scored = teams.map((t, i) => ({
    teamId: t.id,
    score: winZ[i] * WEIGHTS.winPct + diffZ[i] * WEIGHTS.pointDiff + streakZ[i] * WEIGHTS.streak,
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, i) => ({
    teamId: s.teamId,
    score: Math.round(s.score * 100) / 100,
    rank: i + 1,
  }));
}

// Rebuilds each team's regular-season record (and streak) using only games
// through `throughWeek`, straight from the weekly results. This is what lets
// the rankings be recomputed "as of last week" with nothing stored.
export function teamsThroughWeek(teams: Team[], matchups: Matchup[], throughWeek: number): Team[] {
  const finals = regularSeasonFinals(matchups)
    .filter((m) => m.week <= throughWeek)
    .sort((a, b) => a.week - b.week);

  const rec = new Map<number, { w: number; l: number; t: number; pf: number; pa: number; results: ("W" | "L" | "T")[] }>();
  const get = (id: number) => {
    if (!rec.has(id)) rec.set(id, { w: 0, l: 0, t: 0, pf: 0, pa: 0, results: [] });
    return rec.get(id)!;
  };

  for (const m of finals) {
    const h = get(m.homeTeamId);
    const a = get(m.awayTeamId);
    h.pf += m.homeScore;
    h.pa += m.awayScore;
    a.pf += m.awayScore;
    a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.w++;
      a.l++;
      h.results.push("W");
      a.results.push("L");
    } else if (m.awayScore > m.homeScore) {
      a.w++;
      h.l++;
      a.results.push("W");
      h.results.push("L");
    } else {
      h.t++;
      a.t++;
      h.results.push("T");
      a.results.push("T");
    }
  }

  return teams.map((t) => {
    const r = rec.get(t.id);
    if (!r) return { ...t, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, streak: undefined };
    const last = r.results[r.results.length - 1];
    let run = 0;
    for (let i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) run++;
    return {
      ...t,
      wins: r.w,
      losses: r.l,
      ties: r.t,
      pointsFor: r.pf,
      pointsAgainst: r.pa,
      streak: last === "W" || last === "L" ? `${last}${run}` : undefined,
    };
  });
}

// Power rankings with week-over-week movement. Once at least one regular-
// season week is final, both the current ranking and last week's are
// computed from the same weekly results (so the arrows always agree with the
// list). Before that, it falls back to the plain standings and shows no
// movement.
export function calculatePowerRankingsWithMovement(
  teams: Team[],
  matchups: Matchup[],
  maxWeek?: number // rank "as of" this week instead of the latest final week (used by the newsletter)
): { rankings: PowerRankingEntry[]; teams: Team[]; throughWeek: number } {
  const latest = regularSeasonFinals(matchups).reduce((max, m) => Math.max(max, m.week), 0);
  const throughWeek = maxWeek ? Math.min(latest, maxWeek) : latest;
  if (throughWeek === 0) return { rankings: calculatePowerRankings(teams), teams, throughWeek: 0 };

  const currentTeams = teamsThroughWeek(teams, matchups, throughWeek);
  const rankings = calculatePowerRankings(currentTeams);

  if (throughWeek > 1) {
    const prevRank = new Map(calculatePowerRankings(teamsThroughWeek(teams, matchups, throughWeek - 1)).map((r) => [r.teamId, r.rank]));
    for (const r of rankings) r.previousRank = prevRank.get(r.teamId);
  }
  return { rankings, teams: currentTeams, throughWeek };
}
