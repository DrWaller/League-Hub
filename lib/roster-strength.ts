// Server-side only (reads ESPN through lib/vor.ts). Never import from a Client Component.
//
// Roster strength for the power rankings: for each of the last few weeks, how
// much value over replacement (VOR) each fantasy team's BEST possible lineup
// produced. It fills the league's real lineup slots (C, LW, RW, D, G, then
// F, then Util) with the team's highest-VOR players, bench included -- so it
// rates the roster itself, not how well the owner set the lineup.

import { getWeekVor, Pos, VorPlayer } from "@/lib/vor";
import { calculatePowerRankingsWithMovement, rankingThroughWeek, ROSTER_LOOKBACK, WeeklyStrength } from "@/lib/power-rankings";
import { Matchup, Team } from "@/lib/types";

const FORWARDS: Pos[] = ["C", "LW", "RW"];
const SKATERS: Pos[] = ["C", "LW", "RW", "D"];

function bestLineupVor(players: VorPlayer[], slots: Record<string, number>): number {
  const used = new Set<number>();
  let total = 0;
  const take = (eligible: Pos[], n: number) => {
    const cands = players.filter((p) => !used.has(p.id) && eligible.includes(p.position)).sort((a, b) => b.vor - a.vor);
    for (const p of cands.slice(0, Math.max(0, n))) {
      used.add(p.id);
      total += p.vor;
    }
  };
  take(["C"], slots.C ?? 0);
  take(["LW"], slots.LW ?? 0);
  take(["RW"], slots.RW ?? 0);
  take(["D"], slots.D ?? 0);
  take(["G"], slots.G ?? 0);
  take(FORWARDS, slots.F ?? 0);
  take(SKATERS, slots.Util ?? 0);
  return total;
}

// Short in-memory cache so the home page and graphics don't re-fetch ESPN on every load.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: WeeklyStrength }>();

export async function getWeeklyRosterStrength(season: number, throughWeek: number): Promise<WeeklyStrength | undefined> {
  if (throughWeek < 1) return undefined;
  const key = `${season}:${throughWeek}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  // One extra week so the "previous week" ranking has a full window too.
  const weeks: number[] = [];
  for (let w = throughWeek; w >= 1 && weeks.length < ROSTER_LOOKBACK + 1; w--) weeks.push(w);

  const results = await Promise.all(weeks.map((w) => getWeekVor(w, season, season).catch(() => null)));
  const out: WeeklyStrength = new Map();
  results.forEach((r, i) => {
    if (!r) return;
    const byTeam = new Map<number, VorPlayer[]>();
    for (const p of r.players) {
      if (!byTeam.has(p.teamId)) byTeam.set(p.teamId, []);
      byTeam.get(p.teamId)!.push(p);
    }
    const strengths = new Map<number, number>();
    for (const [teamId, players] of byTeam) strengths.set(teamId, bestLineupVor(players, r.slots));
    out.set(weeks[i], strengths);
  });
  if (out.size === 0) return undefined;
  cache.set(key, { at: Date.now(), value: out });
  return out;
}

// Drop-in for calculatePowerRankingsWithMovement that also folds in roster
// strength. If ESPN can't supply it, the ranking quietly runs without it.
export async function calculatePowerRankingsWithRoster(teams: Team[], matchups: Matchup[], season: number, maxWeek?: number) {
  const throughWeek = rankingThroughWeek(matchups, maxWeek);
  let strength: WeeklyStrength | undefined;
  try {
    strength = await getWeeklyRosterStrength(season, throughWeek);
  } catch {
    strength = undefined;
  }
  return calculatePowerRankingsWithMovement(teams, matchups, maxWeek, strength);
}
