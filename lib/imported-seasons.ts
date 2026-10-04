import { sql } from "./db";

// A season that was played somewhere other than ESPN (the 2025 Fantrax season), imported once from a
// Fantrax CSV plus the NHL's public stats (see lib/season-import.ts) and stored as one JSON document.

export interface ImportedPlayer {
  nhlId: number | null; // null = on the Fantrax list but not found in the NHL data (points only)
  fid: string;
  name: string;
  team: string;
  position: string;
  positionId: number;
  owner: string; // Fantrax owner's short name, or "FA"
  age: number;
  rank: number; // Fantrax's overall rank
  gp: number;
  appliedTotal: number; // the league's own fantasy points for the season
  stats: Record<string, number>; // ESPN-style stat ids
}

export interface ImportedSeason {
  season: number;
  importedAt: string;
  // Forwards and defensemen can be scored differently (your 2025 league paid defensemen more per goal and assist).
  scoringItems: { forwards: { statId: number; points: number }[]; defensemen: { statId: number; points: number }[]; goalies: { statId: number; points: number }[] };
  fit: { forwardsR2: number | null; defensemenR2: number | null; goaliesR2: number | null };
  players: ImportedPlayer[];
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS imported_seasons (
      season INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );
  `;
}

export async function saveImportedSeason(data: ImportedSeason) {
  await ensureTable();
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO imported_seasons (season, payload) VALUES (${data.season}, ${payload})
    ON CONFLICT (season) DO UPDATE SET payload = ${payload}, updated_at = now();
  `;
}

export async function getImportedSeason(season: number): Promise<ImportedSeason | null> {
  try {
    await ensureTable();
    const r = await sql`SELECT payload FROM imported_seasons WHERE season = ${season};`;
    if (!r.rows.length) return null;
    return JSON.parse(r.rows[0].payload as string) as ImportedSeason;
  } catch (err) {
    console.error("getImportedSeason failed (is Postgres connected?)", err);
    return null;
  }
}

export async function listImportedSeasons(): Promise<number[]> {
  try {
    await ensureTable();
    const r = await sql`SELECT season FROM imported_seasons ORDER BY season DESC;`;
    return r.rows.map((x) => Number(x.season));
  } catch {
    return [];
  }
}
