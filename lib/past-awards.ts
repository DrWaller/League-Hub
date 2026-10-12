// Rebuilds the player awards for a finished season from the saved league-wide season stats (no weekly data, so it
// is light). Art Ross is exact (most fantasy points among skaters). The VOR-based awards (Hart, Norris, Vezina,
// Forward) are an ESTIMATE: the live site adds up each week's value over replacement, but a past season only has
// season totals, so replacement level is set once from the whole season's best league-wide lineup.

import type { PoolRow } from "./player-trends";

const FWD = ["C", "LW", "RW"];
const SKT = ["C", "LW", "RW", "D"];
const SLOT = { C: 0, LW: 1, RW: 2, F: 3, D: 4, G: 5, UTIL: 6 };

export interface PastEntry {
  id: number;
  name: string;
  position: string;
  rank: number;
  value: string;
  detail: string;
}

export interface PastLeaders {
  artross: PastEntry[];
  hart: PastEntry[];
  norris: PastEntry[];
  vezina: PastEntry[];
  forward: PastEntry[];
  vorAll: { id: number; name: string; position: string; vor: number }[]; // every player's estimated season VOR
}

const f1 = (n: number) => n.toFixed(1);


// Replacement level per game at each position: fill the league's starting slots from the season's totals (dedicated
// slots, then F = any forward, then Util = any skater); the lowest-scoring starter at a position sets that position's
// bar, divided by the games the starters there played. Null when the lineup slots are unknown.
export function replacementPerGame(pool: PoolRow[], counts: Record<number, number> | null, teamCount: number): Record<string, number> | null {
  if (!counts || teamCount <= 0) return null;
  const taken = new Set<number>();
  const take = (eligible: string[], n: number) => {
    const cands = pool.filter((r) => !taken.has(r.id) && eligible.includes(r.position)).sort((a, b) => b.points - a.points);
    for (const r of cands.slice(0, Math.max(0, n))) taken.add(r.id);
  };
  take(["C"], teamCount * (counts[SLOT.C] ?? 0));
  take(["LW"], teamCount * (counts[SLOT.LW] ?? 0));
  take(["RW"], teamCount * (counts[SLOT.RW] ?? 0));
  take(["D"], teamCount * (counts[SLOT.D] ?? 0));
  take(["G"], teamCount * (counts[SLOT.G] ?? 0));
  take(FWD, teamCount * (counts[SLOT.F] ?? 0));
  take(SKT, teamCount * (counts[SLOT.UTIL] ?? 0));
  const perGame: Record<string, number> = {};
  for (const pos of ["C", "LW", "RW", "D", "G"]) {
    const group = pool.filter((r) => r.position === pos && taken.has(r.id));
    const repl = group.length ? Math.min(...group.map((r) => r.points)) : 0;
    const avgGp = group.length ? group.reduce((n, r) => n + r.gp, 0) / group.length : 0;
    perGame[pos] = avgGp > 0 ? repl / avgGp : 0;
  }
  return perGame;
}

// The "rosterable" bar for the year-over-year awards: points per game at a position, at or above replacement level.
export function rosterableBar(rows: PoolRow[], season: number, counts: Record<number, number> | null, teamCount: number): Record<string, number> | null {
  const pool = rows.filter((r) => r.season === season && r.gp > 0 && ["C", "LW", "RW", "D", "G"].includes(r.position));
  return replacementPerGame(pool, counts, teamCount);
}

export function seasonLeaders(rows: PoolRow[], season: number, counts: Record<number, number> | null, teamCount: number, top = 5): PastLeaders {
  const pool = rows.filter((r) => r.season === season && r.gp > 0 && ["C", "LW", "RW", "D", "G"].includes(r.position));

  const entries = (list: { r: PoolRow; score: number; value: string; detail: string }[]): PastEntry[] =>
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((x, i) => ({ id: x.r.id, name: x.r.name, position: x.r.position, rank: i + 1, value: x.value, detail: x.detail }));

  const artross = entries(
    pool.filter((r) => SKT.includes(r.position)).map((r) => ({ r, score: r.points, value: `${f1(r.points)} pts`, detail: `${r.gp} GP` }))
  );

  const perGame = replacementPerGame(pool, counts, teamCount);
  const vorList: { r: PoolRow; vor: number }[] = perGame ? pool.map((r) => ({ r, vor: r.points - perGame[r.position] * r.gp })) : [];

  const vorEntries = (positions: string[]) =>
    entries(
      vorList
        .filter((x) => positions.includes(x.r.position))
        .map((x) => ({ r: x.r, score: x.vor, value: `${x.vor >= 0 ? "+" : ""}${f1(x.vor)} VOR`, detail: `${f1(x.r.points)} pts, ${x.r.gp} GP` }))
    );

  return {
    artross,
    hart: vorEntries(["C", "LW", "RW", "D", "G"]),
    norris: vorEntries(["D"]),
    vezina: vorEntries(["G"]),
    forward: vorEntries(FWD),
    vorAll: vorList.map((x) => ({ id: x.r.id, name: x.r.name, position: x.r.position, vor: x.vor })),
  };
}

export interface DraftPickLite {
  overallPick: number;
  playerId: number | null;
  name: string;
  position: string;
  teamName: string;
  keeper: boolean;
}

export interface PastSleeper {
  name: string;
  position: string;
  teamName: string;
  pick: number;
  finish: number;
  margin: number;
  rank: number;
}

// Sleeping Beauty for a past season: draft slot minus his finish by season VOR among everyone drafted (keeper picks
// are not real slots, so they only serve as comparisons). Matches a pick to a player by id, then by name.
export function sleepingBeautyEstimate(picks: DraftPickLite[], vorAll: PastLeaders["vorAll"], top = 5): PastSleeper[] {
  const byId = new Map(vorAll.map((v) => [v.id, v]));
  const byName = new Map(vorAll.map((v) => [v.name.toLowerCase().replace(/[^a-z0-9]/g, ""), v]));
  const matched = picks
    .map((p) => {
      const v = (p.playerId != null ? byId.get(p.playerId) : undefined) ?? byName.get(p.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
      return v ? { p, vor: v.vor } : null;
    })
    .filter((x): x is { p: DraftPickLite; vor: number } => x !== null);
  const order = [...matched].sort((a, b) => b.vor - a.vor);
  const finish = new Map(order.map((x, i) => [x.p.overallPick, i + 1]));
  return matched
    .filter((x) => !x.p.keeper)
    .map((x) => ({ x, finish: finish.get(x.p.overallPick) ?? 0 }))
    .map(({ x, finish: f }) => ({ name: x.p.name, position: x.p.position, teamName: x.p.teamName, pick: x.p.overallPick, finish: f, margin: x.p.overallPick - f, vor: x.vor }))
    .filter((x) => x.margin > 0)
    .sort((a, b) => b.margin - a.margin || b.vor - a.vor)
    .slice(0, top)
    .map((x, i) => ({ name: x.name, position: x.position, teamName: x.teamName, pick: x.pick, finish: x.finish, margin: x.margin, rank: i + 1 }));
}
