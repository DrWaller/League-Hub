// Server-side only. Keeps each finished week's lineup efficiency (actual vs. best possible lineup, per team)
// in Postgres so the season-long lineup-efficiency tally never has to re-read a whole season from ESPN.
// Weeks are saved once they are final (finished weeks never change), a few at a time, the first time the
// season page or graphic is opened.

import { sql } from "./db";
import { getWeekLineups } from "./lineup-efficiency";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS lineup_weekly (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      actual REAL NOT NULL,
      max REAL NOT NULL,
      miss_days INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season, week, team_id)
    );
  `;
}

export interface StoredLineupWeek {
  week: number;
  teamId: number;
  actual: number;
  max: number;
  missDays: number; // nights that week the lineup left points on the bench
}

async function storedWeeks(season: number): Promise<Set<number>> {
  const r = await sql`SELECT DISTINCT week FROM lineup_weekly WHERE season = ${season};`;
  return new Set(r.rows.map((x) => Number(x.week)));
}

// Saves every finished week not stored yet, at most `limit` per call so a page load stays quick.
export async function syncSeasonLineups(season: number, finishedWeeks: number[], limit = 3): Promise<{ saved: number; waiting: number; failed: number[] }> {
  await ensureTable();
  const have = await storedWeeks(season);
  const missing = [...finishedWeeks].sort((a, b) => a - b).filter((w) => !have.has(w));
  let saved = 0;
  const failed: number[] = [];
  for (const week of missing.slice(0, limit)) {
    const lw = await getWeekLineups(week, season, season).catch(() => null);
    if (!lw) {
      failed.push(week);
      continue;
    }
    const rows = lw.teams.map((t) => ({ team_id: t.teamId, actual: t.actual, max: t.max, miss_days: t.misses.length }));
    const json = JSON.stringify(rows);
    await sql`DELETE FROM lineup_weekly WHERE season = ${season} AND week = ${week};`;
    await sql`
      INSERT INTO lineup_weekly (season, week, team_id, actual, max, miss_days)
      SELECT ${season}, ${week}, r.team_id, r.actual, r.max, r.miss_days
      FROM json_to_recordset(${json}::json) AS r(team_id integer, actual real, max real, miss_days integer);
    `;
    saved++;
  }
  return { saved, waiting: Math.max(0, missing.length - limit), failed };
}

export async function getStoredLineups(season: number): Promise<StoredLineupWeek[]> {
  await ensureTable();
  const r = await sql`SELECT week, team_id, actual, max, miss_days FROM lineup_weekly WHERE season = ${season} ORDER BY week, team_id;`;
  return r.rows.map((x) => ({ week: Number(x.week), teamId: Number(x.team_id), actual: Number(x.actual), max: Number(x.max), missDays: Number(x.miss_days) }));
}

export interface SeasonLineupRow {
  teamId: number;
  actual: number;
  max: number;
  pct: number;
  left: number;
  missDays: number;
  weeks: Map<number, number>; // week -> that week's efficiency (0-1)
  best: { week: number; pct: number } | null;
  worst: { week: number; pct: number } | null;
}

// Season totals: efficiency = all points scored / all points in each week's best lineup.
export function summarizeSeason(rows: StoredLineupWeek[]): { teams: SeasonLineupRow[]; weeks: number[] } {
  const by = new Map<number, SeasonLineupRow>();
  for (const r of rows) {
    if (r.max <= 0) continue;
    const t = by.get(r.teamId) ?? { teamId: r.teamId, actual: 0, max: 0, pct: 0, left: 0, missDays: 0, weeks: new Map<number, number>(), best: null, worst: null };
    t.actual += r.actual;
    t.max += r.max;
    t.missDays += r.missDays;
    const p = r.actual / r.max;
    t.weeks.set(r.week, p);
    if (!t.best || p > t.best.pct) t.best = { week: r.week, pct: p };
    if (!t.worst || p < t.worst.pct) t.worst = { week: r.week, pct: p };
    by.set(r.teamId, t);
  }
  const teams = [...by.values()].map((t) => ({ ...t, pct: t.max > 0 ? t.actual / t.max : 0, left: t.max - t.actual }));
  teams.sort((a, b) => b.pct - a.pct);
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b);
  return { teams, weeks };
}
