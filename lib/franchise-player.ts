// Server-side only. The franchise player: the player who scored the most fantasy points while on a manager's roster,
// across every ESPN season with roster looks. Rosters were read about once a week, so a player's points for a manager are
// estimated as his season total times the share of the season he was on the roster (looks owned / the longest run of
// looks that season). Fantrax seasons have no weekly rosters and are left out.

import { sql } from "./db";
import { getManagerSeasons } from "./content";
import { norm } from "./lines";

export interface FranchiseEntry {
  name: string;
  position: string;
  eligible: string[]; // every position he was listed at for this manager
  seasons: number[];
  weeks: number; // roster looks, about one per week
  points: number; // estimated points scored while on this manager's team
  best: { season: number; points: number } | null; // his best single season for the manager
}

async function loadAllPlayers(managerId: number): Promise<FranchiseEntry[]> {
  const [owned, stats, assignments] = await Promise.all([
    sql`SELECT season, team_id, player_id, name, position, samples FROM roster_owned WHERE source = 'espn';`,
    sql`SELECT season, player_id, gp, points FROM pool_season_stats;`,
    getManagerSeasons(),
  ]);
  if (owned.rows.length === 0 || stats.rows.length === 0) return [];
  const mine = new Set(assignments.filter((a) => a.managerId === managerId).map((a) => `${a.season}|${a.teamId}`));
  const pts = new Map<string, number>();
  for (const s of stats.rows) pts.set(`${s.season}|${s.player_id}`, Number(s.points));
  const seasonLength = new Map<number, number>();
  for (const r of owned.rows) seasonLength.set(Number(r.season), Math.max(seasonLength.get(Number(r.season)) ?? 0, Number(r.samples)));

  const byPlayer = new Map<string, FranchiseEntry>();
  for (const r of owned.rows) {
    if (!mine.has(`${r.season}|${r.team_id}`)) continue;
    const season = Number(r.season);
    const total = pts.get(`${season}|${r.player_id}`);
    const len = seasonLength.get(season) ?? 0;
    if (total == null || len === 0) continue;
    const share = Math.min(1, Number(r.samples) / len);
    const got = Math.max(0, total) * share;
    const k = norm(String(r.name));
    const e = byPlayer.get(k) ?? { name: String(r.name), position: String(r.position), eligible: [], seasons: [], weeks: 0, points: 0, best: null };
    e.points += got;
    for (const x of String(r.position).split(",")) {
      const t = x.trim();
      if (t && !e.eligible.includes(t)) e.eligible.push(t);
    }
    e.weeks += Number(r.samples);
    if (!e.seasons.includes(season)) e.seasons.push(season);
    if (!e.best || got > e.best.points) e.best = { season, points: got };
    byPlayer.set(k, e);
  }
  return [...byPlayer.values()]
    .map((p) => ({ ...p, seasons: p.seasons.sort((a, b) => a - b) }))
    .sort((a, b) => b.points - a.points);
}

export async function loadFranchisePlayers(managerId: number, top = 5): Promise<FranchiseEntry[]> {
  return (await loadAllPlayers(managerId)).slice(0, top);
}

// The all-time team: the best scorers for a manager at each position. A player listed at several positions fills
// one slot only (the best-scoring player is placed first, in his listed order of positions).
export const ALL_TIME_SLOTS: { pos: string; count: number }[] = [
  { pos: "C", count: 2 },
  { pos: "LW", count: 2 },
  { pos: "RW", count: 2 },
  { pos: "D", count: 4 },
  { pos: "G", count: 2 },
];

export interface AllTimeSpot {
  pos: string;
  players: FranchiseEntry[];
}

export async function loadAllTimeTeam(managerId: number): Promise<AllTimeSpot[]> {
  const all = await loadAllPlayers(managerId);
  return placeAllTimeTeam(all);
}

export function placeAllTimeTeam(all: FranchiseEntry[]): AllTimeSpot[] {
  const open = new Map(ALL_TIME_SLOTS.map((s) => [s.pos, s.count]));
  const out = new Map<string, FranchiseEntry[]>(ALL_TIME_SLOTS.map((s) => [s.pos, []]));
  for (const p of [...all].sort((a, b) => b.points - a.points)) {
    const spot = p.eligible.find((x) => (open.get(x) ?? 0) > 0);
    if (!spot) continue;
    open.set(spot, (open.get(spot) ?? 0) - 1);
    out.get(spot)!.push(p);
  }
  return ALL_TIME_SLOTS.map((s) => ({ pos: s.pos, players: out.get(s.pos)! }));
}
