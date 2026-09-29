// ESPN's fantasy hockey API reports a player's raw stat line as an object
// keyed by numeric stat id, e.g. { "13": 2, "14": 1, "29": 5 }. This maps the
// ids the Player Spotlight graphic needs to readable names.
//
// Source: the community-maintained espn-api project's hockey STATS_MAP
// (github.com/cwendt94/espn-api). ESPN doesn't document these officially,
// so if a spotlight ever shows the wrong number under a label, open
// /api/admin/graphics/player-spotlight?week=N&debug=1 (logged in) to see the
// raw ids for that player, then correct the ids below -- this is the only
// place they live.

export const STAT_ID = {
  // Skaters
  goals: "13",
  assists: "14",
  plusMinus: "15",
  shotsOnGoal: "29",
  // Goalies
  wins: "1",
  shotsAgainst: "3",
  goalsAgainst: "4",
  saves: "6",
  shutouts: "7",
} as const;

function num(stats: Record<string, number>, id: string): number {
  const v = Number(stats[id]);
  return Number.isFinite(v) ? v : 0;
}

export interface StatTile {
  label: string;
  value: string;
}

// ESPN often omits stats that are zero, so a missing id counts as 0 -- but
// only once at least one id we recognise is present, so a player with no
// breakdown at all shows no tiles instead of a row of misleading zeros.
export function spotlightTiles(position: string, stats?: Record<string, number>): StatTile[] {
  if (!stats) return [];
  const known = Object.values(STAT_ID).some((id) => stats[id] !== undefined);
  if (!known) return [];

  if (position === "G") {
    const saves = num(stats, STAT_ID.saves);
    const against = num(stats, STAT_ID.shotsAgainst);
    const svPct = against > 0 ? (saves / against).toFixed(3).replace(/^0/, "") : "—";
    return [
      { label: "SAVES", value: String(saves) },
      { label: "SV%", value: svPct },
      { label: "GA", value: String(num(stats, STAT_ID.goalsAgainst)) },
      { label: "WINS", value: String(num(stats, STAT_ID.wins)) },
    ];
  }

  return [
    { label: "GOALS", value: String(num(stats, STAT_ID.goals)) },
    { label: "ASSISTS", value: String(num(stats, STAT_ID.assists)) },
    { label: "SHOTS", value: String(num(stats, STAT_ID.shotsOnGoal)) },
  ];
}
