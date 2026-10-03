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

// One-line stat summary for the 3 Stars / Top 3 lists: "4 G · 4 A · 10 SOG" for
// skaters, "32 SV · .941 · 2 GA" for goalies. Null when ESPN gave no breakdown.
export function statLine(position: string, stats?: Record<string, number>): string | null {
  if (!stats) return null;
  const known = Object.values(STAT_ID).some((id) => stats[id] !== undefined);
  if (!known) return null;
  if (position === "G") {
    const saves = num(stats, STAT_ID.saves);
    const against = num(stats, STAT_ID.shotsAgainst);
    const svPct = against > 0 ? (saves / against).toFixed(3).replace(/^0/, "") : null;
    return [`${saves} SV`, svPct, `${num(stats, STAT_ID.goalsAgainst)} GA`].filter(Boolean).join(" \u00b7 ");
  }
  return `${num(stats, STAT_ID.goals)} G \u00b7 ${num(stats, STAT_ID.assists)} A \u00b7 ${num(stats, STAT_ID.shotsOnGoal)} SOG`;
}

// Names for ESPN's hockey stat ids (the community espn-api project's STATS_MAP),
// used by the Player Radar to label the league's scoring categories.
//   goalie: only goalies have it; rate: already a rate/average (not divided by games played).
export const STAT_META: Record<string, { label: string; goalie?: boolean; rate?: boolean }> = {
  "0": { label: "GS", goalie: true },
  "1": { label: "W", goalie: true },
  "2": { label: "L", goalie: true },
  "3": { label: "SA", goalie: true },
  "4": { label: "GA", goalie: true },
  "6": { label: "SV", goalie: true },
  "7": { label: "SO", goalie: true },
  "8": { label: "MIN", goalie: true },
  "9": { label: "OTL", goalie: true },
  "10": { label: "GAA", goalie: true, rate: true },
  "11": { label: "SV%", goalie: true, rate: true },
  "13": { label: "G" },
  "14": { label: "A" },
  "15": { label: "+/-" },
  "17": { label: "PIM" },
  "18": { label: "PPG" },
  "19": { label: "PPA" },
  "20": { label: "SHG" },
  "21": { label: "SHA" },
  "22": { label: "GWG" },
  "23": { label: "FOW" },
  "24": { label: "FOL" },
  "27": { label: "ATOI", rate: true },
  "28": { label: "HAT" },
  "29": { label: "SOG" },
  "31": { label: "HIT" },
  "32": { label: "BLK" },
  "33": { label: "DEF" },
  "35": { label: "STPG" },
  "36": { label: "STPA" },
  "37": { label: "STP" },
  "38": { label: "PPP" },
  "39": { label: "SHP" },
};
