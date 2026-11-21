// Goalies whose missed time (injury, personal leave) shouldn't count against them on the Draft Assessment page.
// A goalie listed here is rated on points per team game over the games he was available, not all of his team's games.
//   missedGames: exact number of team games he missed (best), or leave it out and he's rated as a normal starter
//   (STARTER_SHARE of the games he was available) over his own starts.
// Add a goalie by name; the key is the season (2027 = the 2026-27 season).
export const STARTER_SHARE = 0.8;
export const GOALIE_MISSED: Record<number, Record<string, { missedGames?: number }>> = {
  2027: {
    "Connor Hellebuyck": {},
  },
};

// The team games to divide his points by.
export function availableGames(season: number, name: string, teamGames: number, starts: number): number {
  const e = GOALIE_MISSED[season]?.[name];
  if (!e) return teamGames;
  if (e.missedGames != null) return Math.max(1, teamGames - e.missedGames);
  return Math.max(1, Math.min(teamGames, starts / STARTER_SHARE));
}
