// Percentile logic for the Player Radar card. Pure functions (no network) so
// they can be tested. A player's per-game rate in each of the league's scoring
// categories is ranked against every NHL player in the same position group
// (forwards / defensemen / goalies) who has played at least `minGP` games.

import { STAT_META } from "./espn-stats";

export type Group = "F" | "D" | "G";

// ESPN's defaultPositionId: 1 C, 2 LW, 3 RW, 4 D, 5 G
export const groupOfPositionId = (id: number): Group => (id === 5 ? "G" : id === 4 ? "D" : "F");
export const GROUP_NAME: Record<Group, string> = { F: "forwards", D: "defensemen", G: "goalies" };
export const POSITION_LABEL: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };

export interface PoolPlayer {
  id: number;
  name: string;
  positionId: number;
  proTeamId: number;
  gp: number;
  stats: Record<string, number>; // season totals keyed by ESPN stat id
  appliedTotal: number; // fantasy points this league's scoring gives the season so far
}

export interface Category {
  statId: string;
  label: string;
  higherIsBetter: boolean; // false for categories the league scores NEGATIVELY (goals against, PIM...)
  rate: boolean; // already a rate/average, so not divided by games played
}

export interface RadarAxis {
  statId: string;
  label: string;
  value: number; // the player's per-game value
  pct: number; // 0-100, always "bigger is better" (inverted for negatively scored stats)
  higherIsBetter: boolean;
  rate: boolean;
}

// The league's scoring items that apply to this position group, labelled.
export function categoriesFor(group: Group, items: { statId: number; points: number }[]): Category[] {
  const out: Category[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const id = String(it.statId);
    if (!it.points || id === "34" || seen.has(id)) continue; // 34 = games played
    if (group === "F" && id === "33") continue; // DEF (defensemen points) means nothing for a forward
    const meta = STAT_META[id];
    const isGoalieStat = Boolean(meta?.goalie);
    if (isGoalieStat !== (group === "G")) continue;
    seen.add(id);
    out.push({ statId: id, label: meta?.label ?? `Stat ${id}`, higherIsBetter: it.points > 0, rate: Boolean(meta?.rate) });
  }
  return out.sort((a, b) => axisRank(a.statId) - axisRank(b.statId));
}

// Axis order on the chart: related categories sit next to each other (scoring,
// then possession/physical, then penalties) so the shape tells a story.
const AXIS_ORDER = [
  "13", "14", "37", "38", "18", "19", "29", "22", "28", "15", "35", "36", "20", "21", "39", "31", "32", "33", "23", "24", "27", "17", // skaters
  "1", "6", "11", "10", "7", "4", "3", "0", "2", "9", "8", // goalies
];
const axisRank = (statId: string) => {
  const i = AXIS_ORDER.indexOf(statId);
  return i === -1 ? 999 : i;
};

// Stats so rare that most players have none all season (shutouts, OT losses, short-handed
// goals/assists, hat tricks). A percentile on these just collapses the chart to the middle,
// so they are shown as plain season counts beside the chart instead.
export const RARE_STATS = new Set(["7", "9", "20", "21", "28"]);

export function splitRare(cats: Category[]): { axes: Category[]; counts: Category[] } {
  const axes = cats.filter((c) => !RARE_STATS.has(c.statId));
  // A radar needs at least 3 axes; if taking the rare ones out leaves fewer, keep them all as axes.
  if (axes.length < 3) return { axes: cats, counts: [] };
  return { axes, counts: cats.filter((c) => RARE_STATS.has(c.statId)) };
}

export function seasonCount(p: PoolPlayer, c: Category): number {
  const raw = Number(p.stats[c.statId]);
  return Number.isFinite(raw) ? raw : 0;
}

export function perGame(p: PoolPlayer, c: Category): number {
  const raw = Number(p.stats[c.statId]);
  const v = Number.isFinite(raw) ? raw : 0;
  if (c.rate) return v;
  return p.gp > 0 ? v / p.gp : 0;
}

// Early in the season nobody has played much, so the cutoff scales with the
// games leaders have played (half of it, between 1 and 15 games) unless set.
export function minGamesFor(pool: PoolPlayer[], override?: number, cap = 15): number {
  if (override && override > 0) return Math.floor(override);
  const lead = pool.reduce((m, p) => Math.max(m, p.gp), 0);
  return Math.max(1, Math.min(cap, Math.floor(lead * 0.5)));
}

// Share of the pool this value beats (ties count half). A value of nothing
// (zero) in a "more is better" count stat is always 0 -- doing nothing earns no
// percentile just because most players did nothing too. Lower-is-better stats
// are flipped so a bigger number on the chart is always better.
export function percentileOf(value: number, values: number[], higherIsBetter: boolean, zeroIsNothing: boolean): number {
  const n = values.length;
  if (n === 0) return 0;
  if (higherIsBetter && zeroIsNothing && value <= 0) return 0;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < value) below++;
    else if (x === value) equal++;
  }
  const pct = ((below + 0.5 * equal) / n) * 100;
  return higherIsBetter ? pct : 100 - pct;
}

export function buildRadar(me: PoolPlayer, pool: PoolPlayer[], cats: Category[], minGP: number): { axes: RadarAxis[]; eligible: number } {
  const eligible = pool.filter((p) => p.gp >= minGP);
  const axes = cats.map((c) => {
    const value = perGame(me, c);
    const values = eligible.map((p) => perGame(p, c));
    const zeroIsNothing = !c.rate && c.statId !== "15"; // plus/minus can legitimately be zero
    return { statId: c.statId, label: c.label, value, pct: percentileOf(value, values, c.higherIsBetter, zeroIsNothing), higherIsBetter: c.higherIsBetter, rate: c.rate };
  });
  return { axes, eligible: eligible.length };
}

// ---------------------------------------------------------------- fantasy points: total and per game
export interface Standing {
  pct: number; // 0-100 percentile (share of the pool he beats, ties count half)
  rank: number; // 1 = best
  of: number; // how many players he is ranked among
}
export interface PointsLine {
  value: number;
  all: Standing; // vs every eligible NHL player (forwards, defensemen and goalies together)
  position: Standing; // vs eligible players in his own group
}
export interface PointsComparison {
  total: PointsLine; // season fantasy points
  avg: PointsLine; // fantasy points per game played
}

const standing = (value: number, values: number[]): Standing => ({
  pct: percentileOf(value, values, true, false),
  rank: 1 + values.filter((x) => x > value).length,
  of: values.length,
});

// Fantasy points use the league's own scoring, so unlike the category radar they CAN
// be compared across positions. Each group applies its own minimum-games cutoff.
export function pointsComparison(me: PoolPlayer, myGroup: Group, groups: { group: Group; pool: PoolPlayer[]; minGP: number }[]): PointsComparison {
  const eligibleOf = (g: { pool: PoolPlayer[]; minGP: number }) => g.pool.filter((p) => p.gp >= g.minGP);
  const mine = groups.find((g) => g.group === myGroup);
  const posPool = mine ? eligibleOf(mine) : [];
  const allPool = groups.flatMap(eligibleOf);
  const totalOf = (p: PoolPlayer) => p.appliedTotal;
  const avgOf = (p: PoolPlayer) => (p.gp > 0 ? p.appliedTotal / p.gp : 0);
  const line = (f: (p: PoolPlayer) => number): PointsLine => ({
    value: f(me),
    all: standing(f(me), allPool.map(f)),
    position: standing(f(me), posPool.map(f)),
  });
  return { total: line(totalOf), avg: line(avgOf) };
}
