// Server-side only. The per-game replacement level behind each week's VOR (per position), saved once per
// finished week. Lets any stretch of games (like a free-agent pickup's starts) be scored with exactly the
// bar that week's VOR used: VOR = points - replacementPerGame x games.

import { sql } from "./db";
import { getWeekVor, type Pos } from "./vor";

const POSITIONS: Pos[] = ["C", "LW", "RW", "D", "G"];

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS vor_rates (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      position TEXT NOT NULL,
      per_game REAL NOT NULL,
      PRIMARY KEY (season, week, position)
    );
  `;
}

export async function saveRates(season: number, week: number, perGame: Record<Pos, number>) {
  await ensureTable();
  const rows = POSITIONS.map((position) => ({ position, per_game: perGame[position] ?? 0 }));
  const json = JSON.stringify(rows);
  await sql`DELETE FROM vor_rates WHERE season = ${season} AND week = ${week};`;
  await sql`
    INSERT INTO vor_rates (season, week, position, per_game)
    SELECT ${season}, ${week}, r.position, r.per_game FROM json_to_recordset(${json}::json) AS r(position text, per_game real);
  `;
}

// week -> position -> replacement points per game
export async function loadRates(season: number): Promise<Map<number, Record<string, number>>> {
  await ensureTable();
  const r = await sql`SELECT week, position, per_game FROM vor_rates WHERE season = ${season};`;
  const out = new Map<number, Record<string, number>>();
  for (const x of r.rows) {
    const w = Number(x.week);
    const cur = out.get(w) ?? {};
    cur[String(x.position)] = Number(x.per_game);
    out.set(w, cur);
  }
  return out;
}

// Fills in the rate for finished weeks that don't have one yet (weeks saved before rates were kept), a few per call.
export async function syncVorRates(season: number, currentWeek: number, limit = 3): Promise<{ saved: number; waiting: number }> {
  await ensureTable();
  const have = new Set((await sql`SELECT DISTINCT week FROM vor_rates WHERE season = ${season};`).rows.map((x) => Number(x.week)));
  const missing: number[] = [];
  for (let w = 1; w < currentWeek; w++) if (!have.has(w)) missing.push(w);
  let saved = 0;
  for (const week of missing.slice(0, limit)) {
    const vor = await getWeekVor(week, season, season).catch(() => null);
    if (!vor) continue;
    await saveRates(season, week, vor.replacementPerGame);
    saved++;
  }
  return { saved, waiting: Math.max(0, missing.length - limit) };
}
