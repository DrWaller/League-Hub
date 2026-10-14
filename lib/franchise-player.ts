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
  seasons: number[];
  weeks: number; // roster looks, about one per week
  points: number; // estimated points scored while on this manager's team
  best: { season: number; points: number } | null; // his best single season for the manager
}

export async function loadFranchisePlayers(managerId: number, top = 5): Promise<FranchiseEntry[]> {
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
    const e = byPlayer.get(k) ?? { name: String(r.name), position: String(r.position), seasons: [], weeks: 0, points: 0, best: null };
    e.points += got;
    e.weeks += Number(r.samples);
    if (!e.seasons.includes(season)) e.seasons.push(season);
    if (!e.best || got > e.best.points) e.best = { season, points: got };
    byPlayer.set(k, e);
  }
  return [...byPlayer.values()]
    .map((p) => ({ ...p, seasons: p.seasons.sort((a, b) => a - b) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, top);
}
