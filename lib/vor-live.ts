// Server-side only. The week in progress, saved as a "live" player-week so the player races move every day instead of
// once a week. Kept apart from vor_weekly on purpose: records pages (biggest weeks, months) only ever see finished
// weeks. A live week is re-read at most every few hours and dropped as soon as the real week is saved.

import { sql } from "./db";
import { getWeekVor } from "./vor";
import type { StoredVor } from "./vor-store";

const REFRESH_MS = 5 * 60 * 60 * 1000;

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS vor_live (
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
  await sql`CREATE TABLE IF NOT EXISTS vor_live_meta (season INTEGER NOT NULL, week INTEGER NOT NULL, saved_at BIGINT NOT NULL, PRIMARY KEY (season, week));`;
}

// Re-reads the current week's player VOR when the saved copy is older than a few hours (or `force`).
export async function syncLiveVor(season: number, currentWeek: number, force = false): Promise<{ refreshed: boolean }> {
  if (currentWeek < 1) return { refreshed: false };
  await ensureTables();
  // Weeks that have ended are saved for real by syncSeasonVor; their live copies are no longer needed.
  await sql`DELETE FROM vor_live WHERE season = ${season} AND week < ${currentWeek};`;
  await sql`DELETE FROM vor_live_meta WHERE season = ${season} AND week < ${currentWeek};`;
  const meta = await sql`SELECT saved_at FROM vor_live_meta WHERE season = ${season} AND week = ${currentWeek};`;
  const at = meta.rows[0] ? Number(meta.rows[0].saved_at) : 0;
  if (!force && at && Date.now() - at < REFRESH_MS) return { refreshed: false };
  const vor = await getWeekVor(currentWeek, season, season).catch(() => null);
  if (!vor) return { refreshed: false };
  const rows = vor.players.map((p) => ({ player_id: p.id, name: p.name, position: p.position, team_id: p.teamId, points: p.points, vor: p.vor, replacement: p.replacement }));
  const json = JSON.stringify(rows);
  await sql`DELETE FROM vor_live WHERE season = ${season} AND week = ${currentWeek};`;
  await sql`
    INSERT INTO vor_live (season, week, player_id, name, position, team_id, points, vor, replacement)
    SELECT ${season}, ${currentWeek}, r.player_id, r.name, r.position, r.team_id, r.points, r.vor, r.replacement
    FROM json_to_recordset(${json}::json) AS r(player_id integer, name text, position text, team_id integer, points real, vor real, replacement real);
  `;
  await sql`
    INSERT INTO vor_live_meta (season, week, saved_at) VALUES (${season}, ${currentWeek}, ${Date.now()})
    ON CONFLICT (season, week) DO UPDATE SET saved_at = ${Date.now()};
  `;
  return { refreshed: true };
}

export async function loadLiveVor(season: number): Promise<StoredVor[]> {
  try {
    await ensureTables();
    const r = await sql`SELECT * FROM vor_live WHERE season = ${season} ORDER BY week;`;
    return r.rows.map((x) => ({
      season,
      week: Number(x.week),
      playerId: Number(x.player_id),
      name: String(x.name),
      position: String(x.position),
      teamId: Number(x.team_id),
      points: Number(x.points),
      vor: Number(x.vor),
      replacement: Number(x.replacement),
    }));
  } catch {
    return [];
  }
}
