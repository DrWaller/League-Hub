// Server-side only (reads ESPN through lib/games-played.ts and lib/vor.ts). Never import from a Client Component.
//
// "Max points" for one matchup week: how many fantasy points each team's roster COULD have scored if the
// owner had started the best possible lineup every day, versus what the lineup actually scored.
//
// Lineups are set one scoring day at a time, so the best lineup is worked out day by day and added up:
//   - candidates that day = every player on the roster (bench included, IR excluded) who has stats posted
//   - best lineup         = fill the league's real slots (C, LW, RW, D, G, then F, then Util) with the
//                           highest scorers that day. The narrow slots are filled first; every flex slot is
//                           a superset of them, so this gives the true maximum.
//   - actual              = the points of the players who were really in an active slot that day.
// Also records how many points each player scored while sitting on the bench (for "Benchwarmers").

import { getScoringPeriodsForWeek } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { fetchRosterDay } from "@/lib/games-played";
import { fetchLineupSlots, SLOT, type Pos } from "@/lib/vor";

const POS_BY_ID: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const FORWARDS: Pos[] = ["C", "LW", "RW"];
const SKATERS: Pos[] = ["C", "LW", "RW", "D"];
const BENCH = 7;
const IR = 8;

export interface DayPlayer {
  id: number;
  name: string;
  position: Pos;
  points: number;
  slotId: number; // the slot he was really in that day
}

export type SlotCounts = Record<"C" | "LW" | "RW" | "F" | "D" | "G" | "Util", number>;

// Best possible lineup from one day's players. Pure function (easy to test).
export function bestDayLineup(players: { id: number; position: Pos; points: number }[], slots: SlotCounts): { total: number; chosen: Set<number> } {
  const chosen = new Set<number>();
  let total = 0;
  const take = (eligible: Pos[], n: number) => {
    const cands = players.filter((p) => !chosen.has(p.id) && eligible.includes(p.position)).sort((a, b) => b.points - a.points);
    for (const p of cands.slice(0, Math.max(0, n))) {
      chosen.add(p.id);
      total += p.points;
    }
  };
  take(["C"], slots.C);
  take(["LW"], slots.LW);
  take(["RW"], slots.RW);
  take(["D"], slots.D);
  take(["G"], slots.G);
  take(FORWARDS, slots.F);
  take(SKATERS, slots.Util);
  return { total, chosen };
}

export interface BenchPlayer {
  id: number;
  name: string;
  position: Pos;
  benchPoints: number; // points scored on days he sat on the bench
  benchDays: number;
}

// One night where the lineup left points on the table: who should have started, and who they should have replaced.
export interface DaySwap {
  start: { name: string; position: Pos; points: number };
  over: { name: string; position: Pos; points: number } | null; // null = a slot that was left empty
}

export interface DayMiss {
  day: number; // 1 = first scoring day of the week
  actual: number;
  max: number;
  emptySlots: number; // lineup slots with nobody in them that day
  swaps: DaySwap[];
}

export interface TeamLineupWeek {
  teamId: number;
  actual: number;
  max: number;
  bench: BenchPlayer[]; // best bench scorers first
  misses: DayMiss[]; // only the nights that lost points
}

export interface WeekLineups {
  week: number;
  season: number;
  teams: TeamLineupWeek[];
}

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: WeekLineups }>();

export async function getWeekLineups(week: number, season: number, currentSeason: number): Promise<WeekLineups | null> {
  const key = `${season}:${week}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let periods: number[];
  try {
    periods = (await getScoringPeriodsForWeek(week, season === currentSeason ? undefined : season)).periods;
  } catch {
    return null;
  }
  if (periods.length === 0) return null;

  const isCurrent = season === currentSeason;
  const current = isCurrent ? (await getCurrentScoringPeriod()).current : null;
  const [days, counts] = await Promise.all([
    Promise.all(periods.map((sp) => fetchRosterDay(season, sp, !isCurrent || (current != null && sp < current)).then((data) => ({ sp, data })))),
    fetchLineupSlots(season),
  ]);
  if (!counts || !days.some((d) => d.data?.teams)) return null;
  const slots: SlotCounts = {
    C: counts[SLOT.C] ?? 0, LW: counts[SLOT.LW] ?? 0, RW: counts[SLOT.RW] ?? 0, F: counts[SLOT.F] ?? 0,
    D: counts[SLOT.D] ?? 0, G: counts[SLOT.G] ?? 0, Util: counts[SLOT.UTIL] ?? 0,
  };

  const slotTotal = slots.C + slots.LW + slots.RW + slots.F + slots.D + slots.G + slots.Util;
  const totals = new Map<number, { actual: number; max: number; bench: Map<number, BenchPlayer>; misses: DayMiss[] }>();
  for (const [dayIdx, { sp, data }] of days.entries()) {
    for (const t of data?.teams ?? []) {
      const acc = totals.get(t.id) ?? { actual: 0, max: 0, bench: new Map<number, BenchPlayer>(), misses: [] };
      totals.set(t.id, acc);
      const today: DayPlayer[] = [];
      let filled = 0; // active slots with somebody in them (played or not)
      for (const e of t.roster?.entries ?? []) {
        if (Number(e.lineupSlotId) !== BENCH && Number(e.lineupSlotId) !== IR) filled++;
        const pl = e.playerPoolEntry?.player;
        const pos = pl ? POS_BY_ID[pl.defaultPositionId] : undefined;
        if (!pl || !pos) continue;
        const dayStat = (pl.stats ?? []).find((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
        if (!dayStat) continue; // didn't play that day
        today.push({ id: pl.id, name: pl.fullName ?? "Unknown Player", position: pos, points: Number(dayStat.appliedTotal) || 0, slotId: Number(e.lineupSlotId) });
      }
      const actual = today.filter((p) => p.slotId !== BENCH && p.slotId !== IR).reduce((n, p) => n + p.points, 0);
      const bestRes = bestDayLineup(today.filter((p) => p.slotId !== IR), slots);
      const best = Math.max(bestRes.total, actual); // a legal lineup can never beat the best one
      acc.actual += actual;
      acc.max += best;
      if (best - actual > 0.004) {
        const started = today.filter((p) => p.slotId !== BENCH && p.slotId !== IR);
        const startIn = today.filter((p) => bestRes.chosen.has(p.id) && (p.slotId === BENCH));
        const startOut = started.filter((p) => !bestRes.chosen.has(p.id)).sort((a, b) => a.points - b.points);
        const swaps: DaySwap[] = [];
        for (const inP of startIn.sort((a, b) => b.points - a.points)) {
          let k = startOut.findIndex((o) => o.position === inP.position);
          if (k < 0) k = startOut.length > 0 ? 0 : -1;
          const out = k >= 0 ? startOut.splice(k, 1)[0] : null;
          swaps.push({ start: { name: inP.name, position: inP.position, points: inP.points }, over: out ? { name: out.name, position: out.position, points: out.points } : null });
        }
        acc.misses.push({ day: dayIdx + 1, actual: Math.round(actual * 100) / 100, max: Math.round(best * 100) / 100, emptySlots: Math.max(0, slotTotal - filled), swaps });
      }
      for (const p of today) {
        if (p.slotId !== BENCH) continue;
        const b = acc.bench.get(p.id) ?? { id: p.id, name: p.name, position: p.position, benchPoints: 0, benchDays: 0 };
        b.benchPoints += p.points;
        b.benchDays++;
        acc.bench.set(p.id, b);
      }
    }
  }
  if (totals.size === 0) return null;

  const value: WeekLineups = {
    week,
    season,
    teams: [...totals.entries()].map(([teamId, v]) => ({
      teamId,
      actual: Math.round(v.actual * 100) / 100,
      max: Math.round(v.max * 100) / 100,
      bench: [...v.bench.values()].sort((a, b) => b.benchPoints - a.benchPoints),
      misses: v.misses,
    })),
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
