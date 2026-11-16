// Server-side only. All-time fantasy points per game: every player-season the hub can see (ESPN seasons, the
// Fantrax-imported 2025 season, and the season in progress), ranked by average fantasy points per game.
//
// Finished seasons never change, so each one is read once (from the imported Fantrax data, else the ESPN player pool)
// and saved to Postgres; later page loads read that snapshot instead of calling ESPN again. The season in progress
// is always read live. Goalies are per game STARTED (that's what ESPN's games-played is for a goalie).

import { sql } from "@/lib/db";
import { getHistorySeasons } from "@/lib/seasons";
import { getImportedSeason } from "@/lib/imported-seasons";
import { loadPools } from "@/lib/league-tiers";
import type { Group } from "@/lib/radar";

export interface PlayerSeasonRow {
  season: number;
  playerId: number; // <= 0 when the player has no ESPN/NHL id (Fantrax import with no NHL match): no headshot
  name: string;
  positionId: number;
  group: Group;
  gp: number;
  total: number;
  avg: number;
}
export interface RankedPlayerSeason extends PlayerSeasonRow {
  rank: number; // 1 = best average among the rows that qualify
  live: boolean; // the season in progress: it can still move
}

// Compact stored form: [playerId, name, positionId, gp, total]
type Packed = [number, string, number, number, number];

const POS_LABEL: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
export const posLabel = (positionId: number) => POS_LABEL[positionId] ?? "F";
const groupOf = (positionId: number): Group => (positionId === 5 ? "G" : positionId === 4 ? "D" : "F");

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS player_season_snapshots (
      season INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT now()
    );
  `;
}

function unpack(season: number, packed: Packed[]): PlayerSeasonRow[] {
  return packed
    .filter((p) => p[3] > 0)
    .map(([playerId, name, positionId, gp, total]) => ({ season, playerId, name, positionId, group: groupOf(positionId), gp, total, avg: total / gp }));
}

// One finished season, from the snapshot when there is one.
async function finishedSeason(season: number): Promise<PlayerSeasonRow[]> {
  try {
    await ensureTable();
    const r = await sql`SELECT payload FROM player_season_snapshots WHERE season = ${season};`;
    if (r.rows.length) return unpack(season, JSON.parse(r.rows[0].payload as string) as Packed[]);
  } catch (err) {
    console.error("player_season_snapshots read failed (is Postgres connected?)", err);
  }

  let packed: Packed[] = [];
  const imp = await getImportedSeason(season);
  if (imp) {
    packed = imp.players.map((p, i) => [p.nhlId ?? -(i + 1), p.name, p.positionId, p.gp, p.appliedTotal]);
  } else {
    const pools = await loadPools(season, false);
    packed = (["F", "D", "G"] as const).flatMap((g) => pools[g].map((p): Packed => [p.id, p.name, p.positionId, p.gp, p.appliedTotal]));
  }
  // Only keep a snapshot that has real data in it: an ESPN hiccup must not freeze an empty season.
  if (packed.length > 20) {
    try {
      const payload = JSON.stringify(packed);
      await sql`INSERT INTO player_season_snapshots (season, payload) VALUES (${season}, ${payload}) ON CONFLICT (season) DO UPDATE SET payload = ${payload}, updated_at = now();`;
    } catch (err) {
      console.error("player_season_snapshots write failed", err);
    }
  }
  return unpack(season, packed);
}

export interface PlayerAverageOpts {
  minGp: number; // finished seasons: at least this many games
  group?: Group | null; // F / D / G, or all
  fromYear?: number | null; // only seasons from this year on (the Records page's "2021 on" switch)
}

// The season in progress needs fewer games to qualify (it has fewer to play): at most 10, so an early-season star
// can already be placed against the history.
export const liveMinGp = (minGp: number) => Math.min(minGp, 10);

export async function loadPlayerAverages(currentSeason: number, opts: PlayerAverageOpts) {
  const history = (await getHistorySeasons(currentSeason)).filter((s) => s < currentSeason && (!opts.fromYear || s >= opts.fromYear));
  const [past, live] = await Promise.all([
    Promise.all(history.map((s) => finishedSeason(s).catch((err) => { console.error("player season failed", s, err); return [] as PlayerSeasonRow[]; }))),
    opts.fromYear && currentSeason < opts.fromYear
      ? Promise.resolve([] as PlayerSeasonRow[])
      : loadPools(currentSeason, true)
          .then((pools) => (["F", "D", "G"] as const).flatMap((g) => unpack(currentSeason, pools[g].map((p): Packed => [p.id, p.name, p.positionId, p.gp, p.appliedTotal]))))
          .catch((err) => { console.error("live player pool failed", err); return [] as PlayerSeasonRow[]; }),
  ]);

  const liveMin = liveMinGp(opts.minGp);
  const all = [...past.flat(), ...live]
    .filter((r) => (!opts.group || r.group === opts.group) && r.gp >= (r.season === currentSeason ? liveMin : opts.minGp))
    // best average first; a tie goes to the bigger sample (more games), then the older season
    .sort((a, b) => b.avg - a.avg || b.gp - a.gp || a.season - b.season);

  // Ties on the displayed (2-decimal) average share a rank.
  const ranked: RankedPlayerSeason[] = [];
  all.forEach((r, i) => {
    const prev = ranked[i - 1];
    const same = prev && prev.avg.toFixed(2) === r.avg.toFixed(2);
    ranked.push({ ...r, live: r.season === currentSeason, rank: same ? prev.rank : i + 1 });
  });

  return {
    ranked,
    seasons: Array.from(new Set(all.map((r) => r.season))).sort((a, b) => a - b),
    seasonsRead: history.filter((_, i) => past[i].length > 0),
    liveMin,
  };
}
