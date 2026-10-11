// Server-side only. Keeps each finished week's VOR in Postgres so the season's biggest weeks and
// months can be tracked without re-reading ESPN every time. Weeks are saved once they're over
// (past ones never change), the first time the records page is opened.

import { sql } from "./db";
import { getWeekVor } from "./vor";
import type { MonthlyPeriod } from "./types";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS vor_weekly (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      points REAL NOT NULL,
      vor REAL NOT NULL,
      replacement REAL NOT NULL,
      PRIMARY KEY (season, week, player_id)
    );
  `;
}

export interface StoredVor {
  season: number;
  week: number;
  playerId: number;
  name: string;
  position: string;
  teamId: number;
  points: number;
  vor: number;
  replacement: number;
}

const toStored = (r: Record<string, unknown>): StoredVor => ({
  season: Number(r.season),
  week: Number(r.week),
  playerId: Number(r.player_id),
  name: String(r.name),
  position: String(r.position),
  teamId: Number(r.team_id),
  points: Number(r.points),
  vor: Number(r.vor),
  replacement: Number(r.replacement),
});

async function storedWeeks(season: number): Promise<Set<number>> {
  const r = await sql`SELECT DISTINCT week FROM vor_weekly WHERE season = ${season};`;
  return new Set(r.rows.map((x) => Number(x.week)));
}

// Saves every finished week not stored yet, at most `limit` per call so a page load stays quick.
// Returns how many were saved and how many finished weeks are still waiting.
export async function syncSeasonVor(season: number, currentWeek: number, limit = 3): Promise<{ saved: number; waiting: number }> {
  await ensureTable();
  const have = await storedWeeks(season);
  const missing: number[] = [];
  for (let w = 1; w < currentWeek; w++) if (!have.has(w)) missing.push(w);

  let saved = 0;
  for (const week of missing.slice(0, limit)) {
    const vor = await getWeekVor(week, season, season).catch(() => null);
    if (!vor) continue;
    // Everyone who scored: negative weeks matter for monthly totals too.
    const rows = vor.players.map((p) => ({
      player_id: p.id,
      name: p.name,
      position: p.position,
      team_id: p.teamId,
      points: p.points,
      vor: p.vor,
      replacement: p.replacement,
    }));
    const json = JSON.stringify(rows);
    await sql`DELETE FROM vor_weekly WHERE season = ${season} AND week = ${week};`;
    await sql`
      INSERT INTO vor_weekly (season, week, player_id, name, position, team_id, points, vor, replacement)
      SELECT ${season}, ${week}, r.player_id, r.name, r.position, r.team_id, r.points, r.vor, r.replacement
      FROM json_to_recordset(${json}::json) AS r(player_id integer, name text, position text, team_id integer, points real, vor real, replacement real);
    `;
    saved++;
  }
  return { saved, waiting: Math.max(0, missing.length - limit) };
}

export async function getStoredWeekCount(season: number): Promise<number> {
  await ensureTable();
  return (await storedWeeks(season)).size;
}

// The biggest single-week VORs of the season.
export async function getBiggestWeeks(season: number, limit = 10): Promise<StoredVor[]> {
  await ensureTable();
  const r = await sql`SELECT * FROM vor_weekly WHERE season = ${season} ORDER BY vor DESC, points DESC LIMIT ${limit};`;
  return r.rows.map(toStored);
}

// Each stored week's best player.
export async function getWeeklyLeaders(season: number): Promise<StoredVor[]> {
  await ensureTable();
  const r = await sql`
    SELECT DISTINCT ON (week) * FROM vor_weekly WHERE season = ${season} ORDER BY week, vor DESC, points DESC;
  `;
  return r.rows.map(toStored);
}

export interface MonthVor {
  periodLabel: string;
  startWeek: number;
  endWeek: number;
  throughWeek: number; // last stored week inside the period (a month still in progress is "through" it)
  complete: boolean;
  playerId: number;
  name: string;
  position: string;
  teamId: number; // latest owner
  points: number;
  vor: number; // sum of his weekly VOR across the period
}

// The biggest monthly totals across all Monthly Periods (sum of weekly VOR within the period).
export async function getBiggestMonths(season: number, periods: MonthlyPeriod[], limit = 10): Promise<MonthVor[]> {
  await ensureTable();
  const all: MonthVor[] = [];
  for (const p of periods) {
    const r = await sql`SELECT * FROM vor_weekly WHERE season = ${season} AND week >= ${p.startWeek} AND week <= ${p.endWeek} ORDER BY week;`;
    const rows = r.rows.map(toStored);
    if (rows.length === 0) continue;
    const through = Math.max(...rows.map((x) => x.week));
    const byPlayer = new Map<number, MonthVor>();
    for (const x of rows) {
      const m = byPlayer.get(x.playerId);
      if (m) {
        m.points += x.points;
        m.vor += x.vor;
        m.teamId = x.teamId;
      } else {
        byPlayer.set(x.playerId, {
          periodLabel: p.label,
          startWeek: p.startWeek,
          endWeek: p.endWeek,
          throughWeek: through,
          complete: through >= p.endWeek,
          playerId: x.playerId,
          name: x.name,
          position: x.position,
          teamId: x.teamId,
          points: x.points,
          vor: x.vor,
        });
      }
    }
    all.push(...byPlayer.values());
  }
  return all.sort((a, b) => b.vor - a.vor || b.points - a.points).slice(0, limit);
}
