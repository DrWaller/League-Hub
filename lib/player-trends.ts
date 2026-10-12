// Server-side only. League-wide (owned or not) season stats for the "who changed" player awards: Breakout,
// Bounce Back and Most Improved. Each season's most-owned players are saved to Postgres once (past seasons never
// change; the current one is refreshed a few times a day), so a page load doesn't re-read ESPN.

import { sql } from "./db";
import { getPlayerPool } from "./espn";
import type { Group } from "./radar";

const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const REFRESH_CURRENT_MS = 6 * 3600 * 1000;

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS pool_season_stats (
      season INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      gp INTEGER NOT NULL,
      points REAL NOT NULL,
      PRIMARY KEY (season, player_id)
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS pool_season_meta (season INTEGER PRIMARY KEY, fetched_at TIMESTAMPTZ NOT NULL);`;
}

export interface PoolRow {
  season: number;
  id: number;
  name: string;
  position: string;
  gp: number;
  points: number;
}

async function loadSeason(season: number): Promise<PoolRow[]> {
  const r = await sql`SELECT season, player_id, name, position, gp, points FROM pool_season_stats WHERE season = ${season};`;
  return r.rows.map((x) => ({ season: Number(x.season), id: Number(x.player_id), name: String(x.name), position: String(x.position), gp: Number(x.gp), points: Number(x.points) }));
}

async function saveSeason(season: number, currentSeason: number): Promise<boolean> {
  const groups: Group[] = ["F", "D", "G"];
  const pools = await Promise.all(groups.map((g) => getPlayerPool(g, season === currentSeason ? undefined : season)));
  const rows = pools.flat().map((p) => ({ player_id: p.id, name: p.name, position: POS[p.positionId] ?? "?", gp: p.gp, points: p.appliedTotal }));
  if (rows.length === 0) return false; // ESPN gave nothing: don't record this season as fetched
  const json = JSON.stringify(rows);
  await sql`DELETE FROM pool_season_stats WHERE season = ${season};`;
  await sql`
    INSERT INTO pool_season_stats (season, player_id, name, position, gp, points)
    SELECT ${season}, r.player_id, r.name, r.position, r.gp, r.points
    FROM json_to_recordset(${json}::json) AS r(player_id integer, name text, position text, gp integer, points real)
    ON CONFLICT (season, player_id) DO NOTHING;
  `;
  await sql`
    INSERT INTO pool_season_meta (season, fetched_at) VALUES (${season}, now())
    ON CONFLICT (season) DO UPDATE SET fetched_at = now();
  `;
  return true;
}

// Brings the current season and the three before it up to date, at most `limit` seasons per call.
export async function syncPoolStats(currentSeason: number, limit = 2): Promise<{ saved: number; waiting: number }> {
  await ensureTables();
  const meta = await sql`SELECT season, fetched_at FROM pool_season_meta;`;
  const fetchedAt = new Map(meta.rows.map((m) => [Number(m.season), new Date(m.fetched_at as string).getTime()]));
  const wanted = [currentSeason, currentSeason - 1, currentSeason - 2, currentSeason - 3];
  const stale = wanted.filter((s) => {
    const at = fetchedAt.get(s);
    return at === undefined || (s === currentSeason && Date.now() - at > REFRESH_CURRENT_MS);
  });
  let saved = 0;
  for (const s of stale.slice(0, limit)) {
    if (await saveSeason(s, currentSeason).catch(() => false)) saved++;
  }
  return { saved, waiting: Math.max(0, stale.length - limit) };
}

export async function loadPoolStats(currentSeason: number): Promise<PoolRow[]> {
  await ensureTables();
  const r = await sql`
    SELECT season, player_id, name, position, gp, points FROM pool_season_stats WHERE season >= ${currentSeason - 3} AND season <= ${currentSeason};
  `;
  return r.rows.map((x) => ({ season: Number(x.season), id: Number(x.player_id), name: String(x.name), position: String(x.position), gp: Number(x.gp), points: Number(x.points) }));
}

// ---------------------------------------------------------------------------------------------------------
// The awards. All rules live here so they are easy to change.

export const ELITE_SKATERS = 30; // elite = top 30 skaters in points per game (top 8 goalies)
export const ELITE_GOALIES = 8;
export const DOWN_SEASON_DROP = 0.15; // Bounce Back: last season's points per game fell at least this much
export const BOUNCE_RECOVERY = 0.9; // ...and this season he is back to at least this share of the earlier level
const MIN_PREV_GP = { S: 20, G: 15 }; // a past season only counts with this many games (starts for goalies)

type G = "S" | "G";
const groupOf = (position: string): G => (position === "G" ? "G" : "S");

interface Line {
  id: number;
  name: string;
  position: string;
  gp: number;
  points: number;
  ppg: number;
}

export interface TrendEntry {
  id: number;
  name: string;
  position: string;
  rank: number;
  value: string; // headline number
  detail: string; // what it was compared with
}

export interface TrendAward {
  key: "breakout" | "bounce" | "improved" | "calder";
  title: string;
  blurb: string;
  entries: TrendEntry[];
}

const sd = (xs: number[]) => {
  if (xs.length < 2) return 1;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
};

const f2 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${f2(n)}`;

export function buildTrendAwards(rows: PoolRow[], currentSeason: number, top = 5): TrendAward[] {
  const lines = (season: number): Map<number, Line> => {
    const m = new Map<number, Line>();
    for (const r of rows) {
      if (r.season !== season || r.gp <= 0) continue;
      m.set(r.id, { id: r.id, name: r.name, position: r.position, gp: r.gp, points: r.points, ppg: r.points / r.gp });
    }
    return m;
  };
  const cur = lines(currentSeason);
  const prev = [1, 2, 3].map((k) => lines(currentSeason - k)); // prev[0] = last season

  // This season only has a few games so far, so "enough games" scales with the most any player has played.
  const maxGp = (g: G) => Math.max(0, ...[...cur.values()].filter((l) => groupOf(l.position) === g).map((l) => l.gp));
  const minCur = { S: Math.max(3, Math.round(maxGp("S") * 0.4)), G: Math.max(2, Math.round(maxGp("G") * 0.4)) };

  const qualifies = (l: Line | undefined, isCurrent: boolean): l is Line => {
    if (!l) return false;
    const g = groupOf(l.position);
    return l.gp >= (isCurrent ? minCur[g] : MIN_PREV_GP[g]);
  };

  // Elite = in the top N of his group for points per game, among players with enough games that season.
  const eliteSet = (m: Map<number, Line>, isCurrent: boolean): Set<number> => {
    const out = new Set<number>();
    (["S", "G"] as const).forEach((g) => {
      const pool = [...m.values()].filter((l) => groupOf(l.position) === g && qualifies(l, isCurrent)).sort((a, b) => b.ppg - a.ppg);
      pool.slice(0, g === "S" ? ELITE_SKATERS : ELITE_GOALIES).forEach((l) => out.add(l.id));
    });
    return out;
  };
  const eliteNow = eliteSet(cur, true);
  const elitePrev = prev.map((m) => eliteSet(m, false));

  // Spread of points per game (and of season points) in each group, so a goalie's swing and a skater's swing
  // are measured on the same scale when they are ranked against each other.
  const spread = (g: G, pick: (l: Line) => number) => sd([...cur.values()].filter((l) => groupOf(l.position) === g && qualifies(l, true)).map(pick));
  const sdPpg = { S: spread("S", (l) => l.ppg), G: spread("G", (l) => l.ppg) };
  const sdPts = { S: spread("S", (l) => l.points), G: spread("G", (l) => l.points) };

  const entries = (list: { l: Line; score: number; value: string; detail: string }[]): TrendEntry[] =>
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((x, i) => ({ id: x.l.id, name: x.l.name, position: x.l.position, rank: i + 1, value: x.value, detail: x.detail }));

  // Breakout: elite now, never elite in the last three seasons. He needs at least one earlier season on record
  // (a player with none is a rookie and belongs to the Calder).
  const breakout = [...cur.values()]
    .filter((l) => qualifies(l, true) && eliteNow.has(l.id))
    .map((l) => {
      const history = prev.map((m) => m.get(l.id)).filter((p): p is Line => qualifies(p, false));
      if (history.length === 0) return null;
      if (elitePrev.some((s) => s.has(l.id))) return null;
      const best = Math.max(...history.map((p) => p.ppg));
      const g = groupOf(l.position);
      return { l, score: (l.ppg - best) / sdPpg[g], value: `${f2(l.ppg)} pts/gm`, detail: `best before: ${f2(best)}` };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Bounce Back: a clear down season last year, and back near the earlier level now.
  const bounce = [...cur.values()]
    .filter((l) => qualifies(l, true))
    .map((l) => {
      const last = prev[0].get(l.id);
      const before = prev[1].get(l.id);
      if (!qualifies(last, false) || !qualifies(before, false)) return null;
      if (last.ppg > before.ppg * (1 - DOWN_SEASON_DROP)) return null;
      if (l.ppg < before.ppg * BOUNCE_RECOVERY) return null;
      const g = groupOf(l.position);
      return { l, score: (l.ppg - last.ppg) / sdPpg[g], value: `${signed(l.ppg - last.ppg)} pts/gm`, detail: `${f2(l.ppg)} now, ${f2(last.ppg)} last year, ${f2(before.ppg)} the year before` };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Most Improved: the biggest gain on last season, judged two ways and combined: the change in points per game,
  // and the change in total points (this season's points against what last season's pace would have given in the
  // same games, so a part-season is fair). A player's combined score is the average of his two ranks.
  const improvedBase = [...cur.values()]
    .filter((l) => qualifies(l, true))
    .map((l) => {
      const last = prev[0].get(l.id);
      if (!qualifies(last, false)) return null;
      const g = groupOf(l.position);
      const dPpg = l.ppg - last.ppg;
      const dTot = l.points - last.ppg * l.gp;
      return { l, last, dPpg, dTot, nPpg: dPpg / sdPpg[g], nTot: dTot / sdPts[g] };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.dPpg > 0);
  const rankBy = (key: "nPpg" | "nTot") => {
    const order = [...improvedBase].sort((a, b) => b[key] - a[key]);
    return new Map(order.map((x, i) => [x.l.id, i + 1]));
  };
  const rPpg = rankBy("nPpg");
  const rTot = rankBy("nTot");
  const improved = improvedBase.map((x) => {
    const avg = ((rPpg.get(x.l.id) ?? 0) + (rTot.get(x.l.id) ?? 0)) / 2;
    return {
      l: x.l,
      score: -avg + x.nPpg * 0.001, // lowest average rank first; per-game gain breaks ties
      value: `${signed(x.dPpg)} pts/gm`,
      detail: `${f2(x.l.ppg)} vs ${f2(x.last.ppg)} last year, ${signed(x.dTot)} total pts`,
    };
  });


  // Calder: the NHL's own rookie rules, checked against the last three seasons on record. A player is a rookie if he
  // never played more than 25 games in a past season and did not play 6 or more games in each of two past seasons.
  // (The age limit, under 26 by Sept 15, is not checked: ESPN does not give birth dates here.) Best rookie by
  // fantasy points so far, the same measure as the Art Ross.
  const calder = [...cur.values()]
    .filter((l) => {
      const past = prev.map((m) => m.get(l.id)?.gp ?? 0);
      return past.every((gp) => gp <= 25) && past.filter((gp) => gp >= 6).length < 2;
    })
    .map((l) => ({ l, score: l.points + l.ppg * 0.001, value: `${f2(l.points)} pts`, detail: `${l.gp} GP, ${f2(l.ppg)} pts/gm` }));

  return [
    { key: "breakout", title: "Breakout Player", blurb: `Biggest jump into the top ${ELITE_SKATERS} skaters / top ${ELITE_GOALIES} goalies (points per game) for the first time. Players with no earlier season are left to the Calder.`, entries: entries(breakout) },
    { key: "bounce", title: "Bounce Back Player", blurb: `Last year's points per game fell ${DOWN_SEASON_DROP * 100}% or more, and he is back to ${BOUNCE_RECOVERY * 100}% of the earlier level. Ranked by the rebound.`, entries: entries(bounce) },
    { key: "improved", title: "Most Improved Player", blurb: "Biggest gain on last season, combining the change in points per game and the change in total points.", entries: entries(improved) },
    { key: "calder", title: "Calder Trophy", blurb: "Best rookie by fantasy points, owned or not, using the NHL rookie rules (no more than 25 games in any past season, and not 6+ games in each of two past seasons).", entries: entries(calder) },
  ];
}
