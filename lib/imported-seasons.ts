import { sql } from "./db";
import type { Group, PoolPlayer } from "./radar";

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

// ---------------------------------------------------------------- as player pools (pure)
// The saved season as the same PoolPlayer lists the ESPN seasons use, so the percentile code is shared.
//   all       : everyone with games played -- used for fantasy points and ranks
//   withStats : only players found in the NHL data -- used for category percentiles (an unmatched
//               player has no category stats, and zeros would unfairly drag the percentiles)
export interface ImportedPools {
  byGroup: Record<Group, { all: PoolPlayer[]; withStats: PoolPlayer[] }>;
  playerById: Map<number, ImportedPlayer>;
}

export function importedPools(imp: ImportedSeason): ImportedPools {
  const byGroup: ImportedPools["byGroup"] = { F: { all: [], withStats: [] }, D: { all: [], withStats: [] }, G: { all: [], withStats: [] } };
  const playerById = new Map<number, ImportedPlayer>();
  imp.players.forEach((p, i) => {
    const id = p.nhlId ?? -(i + 1); // players the NHL data doesn't have still need a unique id
    const group: Group = p.positionId === 5 ? "G" : p.positionId === 4 ? "D" : "F";
    const pool: PoolPlayer = { id, name: p.name, positionId: p.positionId, proTeamId: 0, gp: p.gp, stats: p.stats, appliedTotal: p.appliedTotal };
    byGroup[group].all.push(pool);
    if (p.nhlId !== null) byGroup[group].withStats.push(pool);
    playerById.set(id, p);
  });
  return { byGroup, playerById };
}

export function importedItemsFor(imp: ImportedSeason, group: Group) {
  return group === "G" ? imp.scoringItems.goalies : group === "D" ? imp.scoringItems.defensemen : imp.scoringItems.forwards;
}
