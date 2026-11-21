// Goalies whose missed time (injury, holdout) shouldn't count against them on the Draft Assessment page.
// A goalie listed here is rated on points per team game over the games he was available, not all of his team's games.
//   availableGames: team games he was available for (best when known, e.g. a season-ending injury early on)
//   missedGames: team games he missed (e.g. an injured-reserve stint)
//   neither: he's rated as a normal starter (STARTER_SHARE of the games he was available) over his own starts.
// Key is the season (2027 = the 2026-27 season). Sources: NHL.com status reports, Daily Faceoff, ESPN (Nov 2026).
export const STARTER_SHARE = 0.8;
export const GOALIE_MISSED: Record<number, Record<string, { availableGames?: number; missedGames?: number }>> = {
  2027: {
    // Held out until traded to New Jersey (not injured); debuted Oct 27.
    "Connor Hellebuyck": {},
    // Season-ending knee/lower-body injury in game 6 (Oct 9).
    "Igor Shesterkin": { availableGames: 6 },
    // Lower-body injury Oct 21, on IR, missed 9 games, back Nov 12.
    "Linus Ullmark": { missedGames: 9 },
  },
};

// The team games to divide his points by.
export function availableGames(season: number, name: string, teamGames: number, starts: number): number {
  const e = GOALIE_MISSED[season]?.[name];
  if (!e) return teamGames;
  if (e.availableGames != null) return Math.max(1, Math.min(teamGames, e.availableGames));
  if (e.missedGames != null) return Math.max(1, teamGames - e.missedGames);
  return Math.max(1, Math.min(teamGames, starts / STARTER_SHARE));
}

// Goalies flagged as hurt or out (any season): they show under Missed Time instead of Busts when behind their slot.
export const isHurtGoalie = (name: string) => Object.values(GOALIE_MISSED).some((m) => name in m);
