// The commissioner's per-season rulings on what counts as regular season:
//  - "Playoffs start in week N": every game from week N on is a playoff game
//    (left out of standings, luck, records). This OVERRIDES whatever ESPN or
//    the pasted scores said about which games were playoffs.
//  - Individual games marked "doesn't count" (e.g. played after elimination).
// Pure logic, no database.

import { Matchup } from "./types";

export interface ExcludedGame {
  week: number;
  teamA: number;
  teamB: number;
}
export interface SeasonRules {
  playoffStartWeek: number | null;
  excluded: ExcludedGame[];
}

export const EMPTY_RULES: SeasonRules = { playoffStartWeek: null, excluded: [] };

// A game is identified by its week and the two teams, in either order.
export const gameKey = (week: number, a: number, b: number) => `${week}:${Math.min(a, b)}:${Math.max(a, b)}`;

export const hasRules = (r: SeasonRules) => r.playoffStartWeek !== null || r.excluded.length > 0;

export function applyRules(matchups: Matchup[], rules: SeasonRules): Matchup[] {
  if (!hasRules(rules)) return matchups;
  const excluded = new Set(rules.excluded.map((e) => gameKey(e.week, e.teamA, e.teamB)));
  return matchups.map((m) => ({
    ...m,
    isPlayoff: rules.playoffStartWeek !== null ? m.week >= rules.playoffStartWeek : m.isPlayoff,
    isExcluded: excluded.has(gameKey(m.week, m.homeTeamId, m.awayTeamId)),
  }));
}

export interface RulesSummary {
  lastWeek: number; // last week that has any game
  regularWeeks: number;
  regularGames: number;
  playoffGames: number;
  excludedGames: number; // regular-season games the commissioner marked as not counting
}

// What the rules add up to, for showing back to the commissioner.
export function summarizeRules(applied: Matchup[]): RulesSummary {
  const regular = applied.filter((m) => !m.isPlayoff);
  return {
    lastWeek: applied.reduce((mx, m) => Math.max(mx, m.week), 0),
    regularWeeks: new Set(regular.filter((m) => !m.isExcluded).map((m) => m.week)).size,
    regularGames: regular.filter((m) => !m.isExcluded).length,
    playoffGames: applied.filter((m) => m.isPlayoff).length,
    excludedGames: regular.filter((m) => m.isExcluded).length,
  };
}
