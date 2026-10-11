// Pure maths, no ESPN calls. Turns each team's score so far plus the points it should still add
// (see getWeekGamesPlayed) into a projected final score and a win probability.
import type { TeamGamesPlayed } from "./games-played";

export interface MatchupProjection {
  homeFinal: number;
  awayFinal: number;
  homeWinPct: number; // 0-100, whole number; home + away = 100
  awayWinPct: number;
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 erf approximation, error < 1.5e-7).
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export function projectMatchup(
  homeScore: number,
  awayScore: number,
  home: TeamGamesPlayed | undefined,
  away: TeamGamesPlayed | undefined
): MatchupProjection | null {
  if (!home || !away) return null;
  if (home.expectedPts == null || away.expectedPts == null || home.variance == null || away.variance == null) return null;

  const homeFinal = homeScore + home.expectedPts;
  const awayFinal = awayScore + away.expectedPts;
  const diff = homeFinal - awayFinal;
  const sd = Math.sqrt(home.variance + away.variance);

  // Nothing left to play: the score decides it (a tie splits).
  const pHome = sd < 1e-9 ? (diff > 0 ? 1 : diff < 0 ? 0 : 0.5) : normalCdf(diff / sd);

  // Never claim certainty from a model: keep the displayed range at 1-99 until it's truly decided.
  const decided = sd < 1e-9;
  const homeWinPct = decided ? Math.round(pHome * 100) : Math.min(99, Math.max(1, Math.round(pHome * 100)));
  return { homeFinal, awayFinal, homeWinPct, awayWinPct: 100 - homeWinPct };
}
