// Server-side only. The league's player tiers: Stream, Depth, Elite, Superstar and Franchise, by average
// fantasy points per game, with separate cutoffs for forwards, defence and goalies.
//
// The cutoffs come from the league's own starter line, so they follow the scoring. Each tier is a share of the
// league's starters at that position (teams x starting slots): Depth = the last starter, Elite = the top 45% of
// starters, Superstar = the top 12%, Franchise = the top 5%. (Checked against 2024 and 2026 in this league: it
// lands within a few hundredths of the hand-made cutoffs for forwards and defence, and fixes the goalie ones.)
//
// They are deliberately NOT live: the cutoffs are rounded to 0.05 and frozen at set checkpoints.
//   under 20 games: last season's final results
//   20, 40 and 60 games: this season so far, frozen at the first look after each checkpoint
// so a tier only moves because a player does, not because the line did.

import { sql } from "@/lib/db";
import { getLeagueMeta, getPlayerPool } from "@/lib/espn";
import { fetchLineupSlots, SLOT } from "@/lib/vor";
import type { Group, PoolPlayer } from "@/lib/radar";
import { getGoalieUsage } from "@/lib/goalie-starts";

import { TIERS, type Tier } from "@/lib/tier-style";
export { TIERS, TIER_STYLE } from "@/lib/tier-style";
export type { Tier };
export type Cutoffs = { depth: number; elite: number; superstar: number; franchise: number };

export interface LeagueTiers {
  v?: number; // cutoff version: 2 = goalies on points per team game
  season: number;
  basis: "last season" | "this season";
  checkpoint: number; // 0 = last season's final, 1-3 = this season at 20 / 40 / 60 games
  gamesPlayed: number;
  cutoffs: Record<Group, Cutoffs>;
  starters: Record<Group, number>; // starters in the league at each position group
}

// Share of the league's starters each tier covers (cumulative: Elite includes Superstar and Franchise).
const SHARE = { franchise: 0.05, superstar: 0.12, elite: 0.45, depth: 1 };
const floor05 = (n: number) => Math.floor(n / 0.05 + 1e-9) * 0.05;
const round2 = (n: number) => Math.round(n * 100) / 100;
const GROUPS: Group[] = ["F", "D", "G"];
const CUTOFF_VERSION = 2;

export function tierOf(avg: number | null, c: Cutoffs): Tier | null {
  if (avg === null || !Number.isFinite(avg)) return null;
  return avg >= c.franchise ? "Franchise" : avg >= c.superstar ? "Superstar" : avg >= c.elite ? "Elite" : avg >= c.depth ? "Depth" : "Stream";
}
export const tierRank = (t: Tier | null) => (t === null ? -1 : TIERS.length - 1 - TIERS.indexOf(t)); // Stream 0 ... Franchise 4

export async function loadPools(season: number, current: boolean): Promise<Record<Group, PoolPlayer[]>> {
  const [F, D, G] = await Promise.all(GROUPS.map((g) => getPlayerPool(g, current ? undefined : season)));
  return { F, D, G };
}

// Goalies are measured on points per TEAM game (points per start x share of starts), so volume counts.
function cutoffsFrom(pools: Record<Group, PoolPlayer[]>, starters: Record<Group, number>, minGp: number, goalieTeamGames: (name: string) => number | null): Record<Group, Cutoffs> {
  const out = {} as Record<Group, Cutoffs>;
  for (const g of GROUPS) {
    const avgs = pools[g]
      .filter((p) => p.gp >= minGp)
      .map((p) => (g === "G" ? p.appliedTotal / (goalieTeamGames(p.name) ?? 82) : p.appliedTotal / p.gp))
      .sort((a, b) => b - a);
    const n = Math.max(1, starters[g]);
    const at = (rank: number) => avgs[Math.min(avgs.length, Math.max(1, rank)) - 1] ?? 0;
    const depth = floor05(at(Math.round(n * SHARE.depth)));
    let elite = floor05(at(Math.round(n * SHARE.elite)));
    let superstar = floor05(at(Math.max(2, Math.round(n * SHARE.superstar))));
    let franchise = floor05(at(Math.max(1, Math.round(n * SHARE.franchise))));
    // Keep the ladder strictly rising, in 0.05 steps.
    if (elite <= depth) elite = depth + 0.05;
    if (superstar <= elite) superstar = elite + 0.05;
    if (franchise <= superstar) franchise = superstar + 0.05;
    out[g] = { depth: round2(depth), elite: round2(elite), superstar: round2(superstar), franchise: round2(franchise) };
  }
  return out;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tier_cutoffs (
      season INTEGER NOT NULL,
      checkpoint INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (season, checkpoint)
    );
  `;
}

export async function getLeagueTiers(): Promise<LeagueTiers | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const slots = await fetchLineupSlots(season);
  if (!slots || !meta.size) return null;
  const perTeam: Record<Group, number> = {
    F: (slots[SLOT.C] ?? 0) + (slots[SLOT.LW] ?? 0) + (slots[SLOT.RW] ?? 0) + (slots[SLOT.F] ?? 0),
    D: slots[SLOT.D] ?? 0,
    G: slots[SLOT.G] ?? 0,
  };
  const starters: Record<Group, number> = { F: perTeam.F * meta.size, D: perTeam.D * meta.size, G: perTeam.G * meta.size };

  // How far into the season: the most games any player has played.
  const cur = await loadPools(season, true);
  const gamesPlayed = Math.max(0, ...GROUPS.flatMap((g) => cur[g].map((p) => p.gp)));
  const checkpoint = gamesPlayed >= 60 ? 3 : gamesPlayed >= 40 ? 2 : gamesPlayed >= 20 ? 1 : 0;

  // Frozen for the checkpoint once saved.
  try {
    await ensureTable();
    const r = await sql`SELECT payload FROM tier_cutoffs WHERE season = ${season} AND checkpoint = ${checkpoint};`;
    if (r.rows.length) {
      const saved = JSON.parse(r.rows[0].payload as string) as LeagueTiers;
      if (saved.v === CUTOFF_VERSION) return { ...saved, gamesPlayed };
    }
  } catch (err) {
    console.error("tier_cutoffs read failed (is Postgres connected?)", err);
  }

  let cutoffs: Record<Group, Cutoffs>;
  if (checkpoint === 0) {
    const usage = await getGoalieUsage(season - 1).catch(() => null);
    cutoffs = cutoffsFrom(await loadPools(season - 1, false), starters, 20, (n) => usage?.teamGames(n) ?? null);
  } else {
    const usage = await getGoalieUsage(season).catch(() => null);
    cutoffs = cutoffsFrom(cur, starters, Math.min(20, Math.max(5, Math.floor(gamesPlayed * 0.5))), (n) => usage?.teamGames(n) ?? null);
  }
  const result: LeagueTiers = { v: CUTOFF_VERSION, season, basis: checkpoint === 0 ? "last season" : "this season", checkpoint, gamesPlayed, cutoffs, starters };
  try {
    const payload = JSON.stringify(result);
    await sql`INSERT INTO tier_cutoffs (season, checkpoint, payload) VALUES (${season}, ${checkpoint}, ${payload}) ON CONFLICT (season, checkpoint) DO UPDATE SET payload = ${payload}, created_at = now();`;
  } catch (err) {
    console.error("tier_cutoffs write failed", err);
  }
  return result;
}
