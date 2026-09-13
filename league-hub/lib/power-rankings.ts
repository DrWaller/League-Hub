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

import { Team, PowerRankingEntry } from "./types";

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
    // Week-over-week movement needs last week's snapshot persisted
    // somewhere (Vercel KV/Postgres, etc.) -- not wired up in v1.
    // See README "Known gaps."
  }));
}
