import { sql } from "./db";
import type { BlurbKind, NightlyBlurb } from "./nightly-blurbs";

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
        (season, scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night)
      VALUES
        (${season}, ${period}, ${date}, ${b.playerId}, ${b.teamId}, ${b.teamName}, ${b.playerName}, ${b.position}, ${b.points}, ${b.active}, ${b.kind}, ${b.statLine}, ${b.text}, ${b.gameOfNight});
    `;
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
  };
}

// The most recent nights that have at least one blurb, newest first. A quiet
// night has no rows, so it simply never appears.
export async function getRecentNights(season: number, nights: number): Promise<StoredNight[]> {
  try {
    await ensureTable();
    const r = await sql`
      SELECT scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night
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
      SELECT scoring_period, night_date, player_id, team_id, team_name, player_name, position, points, active, kind, stat_line, body, game_of_night
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
