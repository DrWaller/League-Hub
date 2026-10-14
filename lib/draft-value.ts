// Server-side only. Draft hits and busts: every pick a manager made is compared with the player who finished at that
// slot. A pick at #12 is "par" if the player scored what the 12th-highest scorer of that season scored; points above
// par are a hit, below are a bust. Seasons need saved season stats (the pool the player awards use), and keepers are
// left out because they weren't picked at that slot.

import { collectManagerPicks } from "./draft-history";
import { loadSeason } from "./player-trends";
import { norm } from "./lines";

export interface PickValue {
  season: number;
  overall: number;
  round: number | null;
  name: string;
  position: string;
  points: number;
  gp: number;
  finish: number; // rank of the player's season points among everyone
  par: number; // points scored by the player who finished at the pick's slot
  surplus: number; // points minus par
}

export interface DraftValue {
  evaluated: number;
  skipped: number; // picks whose player couldn't be matched to season stats
  seasons: number[];
  avgSurplus: number;
  hitRate: number; // share of picks at or above par
  best: PickValue[];
  worst: PickValue[];
  bySeason: { season: number; picks: number; avgSurplus: number }[];
  byRound: { round: number; picks: number; avgSurplus: number }[];
  firstRoundPicks: number;
  firstRoundHitRate: number; // share of first-round picks at or above par
  goalieRound: number | null; // average round of the first goalie taken each draft
  goalieDrafts: number;
}

const MIN_POOL = 100;

export async function loadDraftValue(managerId: number, currentSeason: number): Promise<DraftValue | null> {
  const { mine } = await collectManagerPicks(managerId, currentSeason);
  const picks = mine.filter((p) => !p.keeper && !/^playerId \d+$/.test(p.name));
  if (picks.length === 0) return null;

  const seasons = [...new Set(picks.map((p) => p.season))];
  const pools = new Map<number, { sorted: { name: string; points: number; gp: number }[]; byName: Map<string, { finish: number; points: number; gp: number }> }>();
  await Promise.all(
    seasons.map(async (season) => {
      const rows = await loadSeason(season).catch(() => []);
      if (rows.length < MIN_POOL) return;
      const sorted = rows.map((r) => ({ name: r.name, points: r.points, gp: r.gp })).sort((a, b) => b.points - a.points);
      const byName = new Map<string, { finish: number; points: number; gp: number }>();
      sorted.forEach((r, i) => {
        const k = norm(r.name);
        if (!byName.has(k)) byName.set(k, { finish: i + 1, points: r.points, gp: r.gp });
      });
      pools.set(season, { sorted, byName });
    })
  );

  const values: PickValue[] = [];
  let skipped = 0;
  for (const p of picks) {
    const pool = pools.get(p.season);
    if (!pool) continue; // no stats saved for that season: not counted as skipped, the season is simply unavailable
    const hit = pool.byName.get(norm(p.name));
    const parRow = pool.sorted[Math.min(p.overall, pool.sorted.length) - 1];
    if (!hit || !parRow) {
      skipped++;
      continue;
    }
    values.push({ season: p.season, overall: p.overall, round: p.round, name: p.name, position: p.position, points: hit.points, gp: hit.gp, finish: hit.finish, par: parRow.points, surplus: hit.points - parRow.points });
  }
  if (values.length === 0) return null;

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const bySeason = [...new Set(values.map((v) => v.season))].sort((a, b) => a - b).map((season) => {
    const v = values.filter((x) => x.season === season);
    return { season, picks: v.length, avgSurplus: avg(v.map((x) => x.surplus)) };
  });
  const rounds = [...new Set(values.map((v) => v.round).filter((r): r is number => r != null))].sort((a, b) => a - b);
  const byRound = rounds.map((round) => {
    const v = values.filter((x) => x.round === round);
    return { round, picks: v.length, avgSurplus: avg(v.map((x) => x.surplus)) };
  });
  const r1 = values.filter((v) => v.round === 1);
  // The first goalie taken in each draft, by round (position comes from the draft pick itself).
  const firstGoalie: number[] = [];
  for (const season of seasons) {
    const g = picks.filter((p) => p.season === season && p.position === "G" && p.round != null).map((p) => p.round as number);
    if (g.length) firstGoalie.push(Math.min(...g));
  }
  const sorted = [...values].sort((a, b) => b.surplus - a.surplus);
  return {
    evaluated: values.length,
    skipped,
    seasons: bySeason.map((s) => s.season),
    avgSurplus: avg(values.map((v) => v.surplus)),
    hitRate: values.filter((v) => v.surplus >= 0).length / values.length,
    best: sorted.slice(0, 5),
    worst: sorted.slice(-5).reverse(),
    bySeason,
    byRound,
    firstRoundPicks: r1.length,
    firstRoundHitRate: r1.length ? r1.filter((v) => v.surplus >= 0).length / r1.length : 0,
    goalieRound: firstGoalie.length ? avg(firstGoalie) : null,
    goalieDrafts: firstGoalie.length,
  };
}
