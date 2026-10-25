import { sql } from "./db";
import { isMonsterNight, type BlurbKind, type NightlyBlurb } from "./nightly-blurbs";

// Table is created on first use, like the rest of the hub's tables.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS nightly_blurbs (
      season INTEGER NOT NULL,
      scoring_period INTEGER NOT NULL,
      night_date TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      team_id INTEGER,
      team_name TEXT,
      player_name TEXT NOT NULL,
      position TEXT,
      points DOUBLE PRECISION NOT NULL,
      active BOOLEAN NOT NULL,
      kind TEXT NOT NULL,
      stat_line TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (season, scoring_period, player_id)
    );
  `;
  await sql`ALTER TABLE nightly_blurbs ADD COLUMN IF NOT EXISTS game_of_night BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE nightly_blurbs ADD COLUMN IF NOT EXISTS stats_json TEXT;`;
}

export interface StoredNight {
  date: string; // YYYY-MM-DD (Toronto)
  period: number;
  blurbs: NightlyBlurb[];
}

// Saving a night REPLACES that night's blurbs, so re-running after tuning the
// thresholds leaves exactly what the new rules produce (no stale leftovers).
export async function saveNight(season: number, period: number, date: string, blurbs: NightlyBlurb[]) {
  await ensureTable();
  await sql`DELETE FROM nightly_blurbs WHERE season = ${season} AND scoring_period = ${period};`;
  for (const b of blurbs) {
    await sql`
      INSERT INTO nightly_blurbs
        (season, scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night, stats_json)
      VALUES
        (${season}, ${period}, ${date}, ${b.playerId}, ${b.teamId}, ${b.teamName}, ${b.playerName}, ${b.position}, ${b.points}, ${b.active}, ${b.kind}, ${b.statLine}, ${b.text}, ${b.gameOfNight}, ${b.stats ? JSON.stringify(b.stats) : null});
    `;
  }
}

function parseStats(v: unknown): Record<string, number> | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? (o as Record<string, number>) : undefined;
  } catch {
    return undefined;
  }
}

function rowToBlurb(row: Record<string, unknown>): NightlyBlurb {
  return {
    playerId: Number(row.player_id),
    playerName: row.player_name as string,
    position: (row.position as string) ?? "?",
    teamId: Number(row.team_id),
    teamName: (row.team_name as string) ?? "",
    points: Number(row.points),
    active: Boolean(row.active),
    kind: row.kind as BlurbKind,
    statLine: (row.stat_line as string | null) ?? null,
    text: row.body as string,
    gameOfNight: Boolean(row.game_of_night),
    stats: parseStats(row.stats_json),
  };
}

// The most recent nights that have at least one blurb, newest first. A quiet
// night has no rows, so it simply never appears.
export async function getRecentNights(season: number, nights: number): Promise<StoredNight[]> {
  try {
    await ensureTable();
    const r = await sql`
      SELECT scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night, stats_json
      FROM nightly_blurbs
      WHERE season = ${season}
      ORDER BY night_date DESC, game_of_night DESC, points DESC
      LIMIT 150;
    `;
    const byNight = new Map<string, StoredNight>();
    for (const row of r.rows) {
      const date = row.night_date as string;
      if (!byNight.has(date)) {
        if (byNight.size >= nights) break;
        byNight.set(date, { date, period: Number(row.scoring_period), blurbs: [] });
      }
      byNight.get(date)!.blurbs.push(rowToBlurb(row));
    }
    return Array.from(byNight.values());
  } catch (err) {
    console.error("getRecentNights failed (is Postgres connected?)", err);
    return [];
  }
}

// One specific night (YYYY-MM-DD), or the latest one when no date is given.
// Used by the Big Nights graphic. Null when nothing is saved for it.
export async function getNight(season: number, date?: string): Promise<StoredNight | null> {
  if (!date) return (await getRecentNights(season, 1))[0] ?? null;
  try {
    await ensureTable();
    const r = await sql`
      SELECT scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night, stats_json
      FROM nightly_blurbs
      WHERE season = ${season} AND night_date = ${date}
      ORDER BY game_of_night DESC, points DESC;
    `;
    if (!r.rows.length) return null;
    return { date, period: Number(r.rows[0].scoring_period), blurbs: r.rows.map(rowToBlurb) };
  } catch (err) {
    console.error("getNight failed (is Postgres connected?)", err);
    return null;
  }
}

export interface MonsterCount {
  playerId: number;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  nights: number; // Monster Nights this season
  best: number; // his biggest night, in fantasy points
  total: number; // fantasy points across his Monster Nights
}

// "Fantasy Monster": how many Monster Nights each player has had this season, most first (ties go to the
// bigger best night). Counts every player on a Big Night card, rostered or not, and only nights the
// nightly job has saved.
export async function getMonsterCounts(season: number): Promise<MonsterCount[]> {
  try {
    await ensureTable();
    const r = await sql`
      SELECT player_id, team_id, team_name, player_name, position, points, night_date
      FROM nightly_blurbs
      WHERE season = ${season}
      ORDER BY night_date ASC;
    `;
    const byPlayer = new Map<number, MonsterCount>();
    for (const row of r.rows) {
      const position = (row.position as string) ?? "?";
      const points = Number(row.points);
      if (!isMonsterNight(points, position)) continue;
      const id = Number(row.player_id);
      const cur = byPlayer.get(id) ?? {
        playerId: id, name: row.player_name as string, position, teamId: Number(row.team_id), teamName: (row.team_name as string) ?? "",
        nights: 0, best: 0, total: 0,
      };
      cur.nights += 1;
      cur.best = Math.max(cur.best, points);
      cur.total += points;
      cur.teamId = Number(row.team_id); // rows run oldest to newest, so this ends on his latest fantasy team
      cur.teamName = (row.team_name as string) ?? cur.teamName;
      byPlayer.set(id, cur);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.nights - a.nights || b.best - a.best);
  } catch (err) {
    console.error("getMonsterCounts failed (is Postgres connected?)", err);
    return [];
  }
}

export interface BigNight {
  playerId: number;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  points: number;
  date: string; // YYYY-MM-DD (Toronto)
  statLine: string | null;
}

// "Biggest Night": the highest single-night fantasy scores of the season, any player, rostered or not.
// Only nights the nightly job saved can appear (every night that matters is a Big Night anyway).
export async function getBiggestNights(season: number, limit = 5): Promise<BigNight[]> {
  try {
    await ensureTable();
    const r = await sql`
      SELECT player_id, player_name, position, team_id, team_name, points, night_date, stat_line
      FROM nightly_blurbs
      WHERE season = ${season}
      ORDER BY points DESC, night_date ASC
      LIMIT ${limit};
    `;
    return r.rows.map((row) => ({
      playerId: Number(row.player_id),
      name: row.player_name as string,
      position: (row.position as string) ?? "?",
      teamId: Number(row.team_id),
      teamName: (row.team_name as string) ?? "",
      points: Number(row.points),
      date: row.night_date as string,
      statLine: (row.stat_line as string | null) ?? null,
    }));
  } catch (err) {
    console.error("getBiggestNights failed (is Postgres connected?)", err);
    return [];
  }
}

// ---- Team nights ("Manager's Biggest Night") ----
// What each fantasy team scored on one night: the points of the players in its active lineup that day.
async function ensureTeamTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS team_nightly (
      season INTEGER NOT NULL,
      scoring_period INTEGER NOT NULL,
      night_date TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      team_name TEXT,
      points DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (season, scoring_period, team_id)
    );
  `;
}

export interface TeamNightRow {
  teamId: number;
  teamName: string;
  points: number;
}

// Replaces that night's team totals (like saveNight does for the blurbs).
export async function saveTeamNights(season: number, period: number, date: string, rows: TeamNightRow[]) {
  await ensureTeamTable();
  await sql`DELETE FROM team_nightly WHERE season = ${season} AND scoring_period = ${period};`;
  for (const r of rows) {
    await sql`
      INSERT INTO team_nightly (season, scoring_period, night_date, team_id, team_name, points)
      VALUES (${season}, ${period}, ${date}, ${r.teamId}, ${r.teamName}, ${r.points});
    `;
  }
}

export async function hasTeamNights(season: number, date: string): Promise<boolean> {
  try {
    await ensureTeamTable();
    const r = await sql`SELECT 1 FROM team_nightly WHERE season = ${season} AND night_date = ${date} LIMIT 1;`;
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

export interface BigTeamNight {
  teamId: number;
  teamName: string;
  points: number;
  date: string;
}

// The highest single-night team scores of the season.
export async function getBiggestTeamNights(season: number, limit = 5): Promise<BigTeamNight[]> {
  try {
    await ensureTeamTable();
    const r = await sql`
      SELECT team_id, team_name, points, night_date FROM team_nightly
      WHERE season = ${season}
      ORDER BY points DESC, night_date ASC
      LIMIT ${limit};
    `;
    return r.rows.map((x) => ({ teamId: Number(x.team_id), teamName: (x.team_name as string) ?? "", points: Number(x.points), date: x.night_date as string }));
  } catch (err) {
    console.error("getBiggestTeamNights failed (is Postgres connected?)", err);
    return [];
  }
}

// ---- Past-season backfill bookkeeping ----
async function ensureScannedTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS nightly_scanned (
      season INTEGER NOT NULL,
      scoring_period INTEGER NOT NULL,
      PRIMARY KEY (season, scoring_period)
    );
  `;
}

// Days already read for a season (including days with no games, so they are never asked for twice).
export async function getScannedPeriods(season: number): Promise<Set<number>> {
  await ensureScannedTable();
  const r = await sql`SELECT scoring_period FROM nightly_scanned WHERE season = ${season};`;
  return new Set(r.rows.map((x) => Number(x.scoring_period)));
}

export async function markScanned(season: number, period: number) {
  await ensureScannedTable();
  await sql`INSERT INTO nightly_scanned (season, scoring_period) VALUES (${season}, ${period}) ON CONFLICT DO NOTHING;`;
}

// ---- All-time single-night records (every saved season) ----
export interface AllTimePlayerNight {
  season: number;
  playerId: number;
  name: string;
  position: string;
  teamName: string;
  points: number;
  date: string;
  statLine: string | null;
}
export interface AllTimeTeamNight {
  season: number;
  teamName: string;
  points: number;
  date: string;
}

export async function getAllTimeNights(limit = 10): Promise<{ players: AllTimePlayerNight[]; teams: AllTimeTeamNight[]; seasons: number[] }> {
  try {
    await ensureTable();
    await ensureTeamTable();
    const [p, t, s] = await Promise.all([
      sql`SELECT season, player_id, player_name, position, team_name, points, night_date, stat_line FROM nightly_blurbs ORDER BY points DESC, night_date ASC LIMIT ${limit};`,
      sql`SELECT season, team_name, points, night_date FROM team_nightly ORDER BY points DESC, night_date ASC LIMIT ${limit};`,
      sql`SELECT DISTINCT season FROM team_nightly ORDER BY season;`,
    ]);
    return {
      players: p.rows.map((x) => ({
        season: Number(x.season), playerId: Number(x.player_id), name: x.player_name as string, position: (x.position as string) ?? "?",
        teamName: (x.team_name as string) ?? "", points: Number(x.points), date: x.night_date as string, statLine: (x.stat_line as string | null) ?? null,
      })),
      teams: t.rows.map((x) => ({ season: Number(x.season), teamName: (x.team_name as string) ?? "", points: Number(x.points), date: x.night_date as string })),
      seasons: s.rows.map((x) => Number(x.season)),
    };
  } catch (err) {
    console.error("getAllTimeNights failed (is Postgres connected?)", err);
    return { players: [], teams: [], seasons: [] };
  }
}
