// Server-side only. Draft assessment: every pick of the current season's draft in order, with the player's season
// total, average fantasy points per game and league tier. Picks come from the saved draft (full recap first, else
// the saved history); stats come from the live player pool; tiers use the same frozen cutoffs as the Tier Lists page.

import { sql } from "@/lib/db";
import { getLeagueMeta } from "@/lib/espn";
import { ensureDraftSchema } from "@/lib/draft";
import { getLeagueTiers, loadPools, tierOf, type Tier } from "@/lib/league-tiers";
import { makeGoalieRater } from "@/lib/team-makeup";
import { NHL_ABBREV } from "@/lib/best-available";
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
  perTeamGame: number | null; // goalies only: the number their tier is set on
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

  const [tiers, pools, prevPools] = await Promise.all([getLeagueTiers(), loadPools(season, true), loadPools(season - 1, false)]);
  // Same as the Tier Lists "Season" tier: skaters on avg pts per game (5+ GP); goalies on the rating's points per
  // team game (points per start x share of team games started), so a goalie's volume counts.
  const maxGp = Math.max(0, ...pools.G.map((g) => g.gp));
  const { rate: rateG } = await makeGoalieRater(season, maxGp);
  const prior = new Map<number, { gp: number; avg: number }>();
  for (const g of ["F", "D", "G"] as Group[]) for (const p of prevPools[g]) if (p.gp > 0) prior.set(p.id, { gp: p.gp, avg: p.appliedTotal / p.gp });
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
    let tier: Tier | null = null;
    let perTeamGame: number | null = null;
    if (tiers && p) {
      if (group === "G") {
        const pr = prior.get(p.id);
        const r = rateG(p.name, NHL_ABBREV[p.proTeamId] ?? "", p.gp > 0 ? { gp: p.gp, avg: p.appliedTotal / p.gp } : null, pr && pr.gp >= 20 ? pr.avg : null, false, null);
        perTeamGame = r ? r.info.perTeamGame : null;
        tier = r ? tierOf(r.info.perTeamGame, tiers.cutoffs.G) : null;
      } else if (avg !== null && p.gp >= 5) tier = tierOf(avg, tiers.cutoffs[group]);
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
      tier,
      perTeamGame,
    };
  });
  const basis = tiers ? `${tiers.basis === "this season" ? "This season's" : "Last season's"} league cutoffs (${tiers.gamesPlayed} GP in)` : "Tier cutoffs unavailable";
  return { season, source, basis, picks };
}
