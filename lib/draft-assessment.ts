// Server-side only. Draft assessment: every pick of the current season's draft in order, with the player's season
// total, average fantasy points per game and league tier. Picks come from the saved draft (full recap first, else
// the saved history); stats come from the live player pool; tiers use the same frozen cutoffs as the Tier Lists page.

import { sql } from "@/lib/db";
import { getLeagueMeta } from "@/lib/espn";
import { ensureDraftSchema } from "@/lib/draft";
import { getLeagueTiers, loadPools, tierOf, type Tier } from "@/lib/league-tiers";
import { getGoalieUsage } from "@/lib/goalie-starts";
import { norm } from "@/lib/lines";
import type { Group, PoolPlayer } from "@/lib/radar";

export interface AssessedPick {
  overall: number;
  round: number | null;
  keeper: boolean;
  team: string;
  manager: string | null;
  name: string;
  position: string;
  total: number | null; // season fantasy points
  gp: number | null;
  avg: number | null; // points per game played
  tier: Tier | null;
}

export interface DraftAssessment {
  season: number;
  source: string;
  basis: string; // where the tier cutoffs come from
  picks: AssessedPick[];
}

const groupOf = (pos: string): Group => (pos === "G" ? "G" : pos === "D" ? "D" : "F");

export async function getDraftAssessment(): Promise<DraftAssessment | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  await ensureDraftSchema();
  const rows = (await sql`SELECT source, overall_pick, round, team_name, manager, player_id, player_name, position, is_keeper FROM draft_picks WHERE season = ${season} ORDER BY overall_pick;`).rows;
  if (rows.length === 0) return null;
  const rank: Record<string, number> = { espn: 0, history: 1, fantrax: 2 };
  const source = rows.map((r) => String(r.source)).sort((a, b) => (rank[a] ?? 9) - (rank[b] ?? 9))[0];
  const list = rows.filter((r) => String(r.source) === source);

  const [tiers, pools, usage] = await Promise.all([getLeagueTiers(), loadPools(season, true), getGoalieUsage(season).catch(() => null)]);
  const byId = new Map<number, PoolPlayer>();
  const byName = new Map<string, PoolPlayer>();
  for (const g of ["F", "D", "G"] as Group[])
    for (const p of pools[g]) {
      byId.set(p.id, p);
      if (!byName.has(norm(p.name))) byName.set(norm(p.name), p);
    }

  const picks: AssessedPick[] = list.map((r) => {
    const name = String(r.player_name ?? "");
    const pid = r.player_id == null ? null : Number(r.player_id);
    const p = (pid != null ? byId.get(pid) : undefined) ?? byName.get(norm(name));
    const position = String(r.position ?? "");
    const group = groupOf(position);
    const total = p ? p.appliedTotal : null;
    const gp = p ? p.gp : null;
    const avg = p && p.gp > 0 ? p.appliedTotal / p.gp : null;
    // Goalie tiers are set on points per TEAM game (volume counts), same as the league tiers.
    let rate = avg;
    if (p && group === "G") {
      const tg = usage?.teamGames(p.name) ?? null;
      rate = tg && tg > 0 ? p.appliedTotal / tg : avg;
    }
    return {
      overall: Number(r.overall_pick),
      round: r.round == null ? null : Number(r.round),
      keeper: Boolean(r.is_keeper),
      team: String(r.team_name ?? ""),
      manager: r.manager ? String(r.manager) : null,
      name,
      position,
      total,
      gp,
      avg,
      tier: tiers && rate != null ? tierOf(rate, tiers.cutoffs[group]) : null,
    };
  });
  const basis = tiers ? `${tiers.basis === "this season" ? "This season's" : "Last season's"} league cutoffs (${tiers.gamesPlayed} GP in)` : "Tier cutoffs unavailable";
  return { season, source, basis, picks };
}
