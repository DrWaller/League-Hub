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
}

const f1 = (n: number) => n.toFixed(1);

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

  let vorList: { r: PoolRow; vor: number }[] = [];
  if (counts && teamCount > 0) {
    // Fill the league's starting slots from the season totals: dedicated slots, then F (any forward), then Util.
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
    vorList = pool.map((r) => ({ r, vor: r.points - perGame[r.position] * r.gp }));
  }

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
  };
}
