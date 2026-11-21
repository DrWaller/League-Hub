// Server-side only. Draft assessment: every pick of the current season's draft in order, with the player's season
// total, average fantasy points per game and league tier. Picks come from the saved draft (full recap first, else
// the saved history); stats come from the live player pool; tiers use the same frozen cutoffs as the Tier Lists page.

import { sql } from "@/lib/db";
import { getLeagueMeta } from "@/lib/espn";
import { ensureDraftSchema } from "@/lib/draft";
import { getAllStored } from "@/lib/vor-store";
import { getLeagueTiers, loadPools, tierOf, type Tier } from "@/lib/league-tiers";
import { getGoalieUsage } from "@/lib/goalie-starts";
import { availableGames } from "@/lib/goalie-exceptions";
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
  playerId: number | null;
  nhl: string | null;
  vor: number | null; // season VOR: his weekly value over the last league starter at his position, summed
  finish: number | null; // current rank of his season VOR among every player with VOR
  par: number | null; // season VOR of the player currently ranked at this pick's slot
  outscoredBy: number; // later non-keeper picks with more VOR than him
  outscored: number; // earlier non-keeper picks with less VOR than him
  surplus: number | null; // VOR minus par: positive = steal, negative = bust (keepers aren't assessed)
}

export interface DraftAssessment {
  season: number;
  source: string;
  basis: string; // where the tier cutoffs come from
  vorWeeks: number; // last finished week included in the VOR numbers (0 = none saved yet)
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

  const [tiers, pools] = await Promise.all([getLeagueTiers(), loadPools(season, true)]);
  // Same as the Tier Lists "Season" tier: skaters on avg pts per game (5+ GP); goalies on the rating's points per
  // team game (points per start x share of team games started), so a goalie's volume counts.
  const maxGp = Math.max(0, ...pools.G.map((g) => g.gp));
  // This season only: a goalie's points divided by his team's games so far (no last-season blend), the same measure the cutoffs use.
  const usage = await getGoalieUsage(season).catch(() => null);
  const byId = new Map<number, PoolPlayer>();
  const byName = new Map<string, PoolPlayer>();
  for (const g of ["F", "D", "G"] as Group[])
    for (const p of pools[g]) {
      byId.set(p.id, p);
      if (!byName.has(norm(p.name))) byName.set(norm(p.name), p);
    }

  // Season VOR per player (sum of his saved weekly VOR, one scale for every position and games played). A pick is "par"
  // if he has the VOR of the player currently ranked at his draft slot. Players who never posted a game count as 0.
  const stored = await getAllStored(season).catch(() => []);
  const vorBy = new Map<number, number>();
  let vorWeeks = 0;
  for (const r of stored) {
    vorBy.set(r.playerId, (vorBy.get(r.playerId) ?? 0) + r.vor);
    vorWeeks = Math.max(vorWeeks, r.week);
  }
  const ranked = Array.from(vorBy.entries()).map(([id, vor]) => ({ id, vor })).sort((a, b) => b.vor - a.vor);
  const finishById = new Map<number, number>();
  ranked.forEach((r, i) => finishById.set(r.id, i + 1));

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
        const tg = usage?.teamGames(p.name) ?? maxGp;
        const den = availableGames(season, p.name, tg, p.gp);
        perTeamGame = tg > 0 && p.gp > 0 ? Math.round((p.appliedTotal / den) * 100) / 100 : null;
        tier = perTeamGame != null ? tierOf(perTeamGame, tiers.cutoffs.G) : null;
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
      playerId: p ? p.id : pid,
      nhl: p ? NHL_ABBREV[p.proTeamId] ?? null : null,
      vor: p && vorWeeks > 0 ? Math.round((vorBy.get(p.id) ?? 0) * 100) / 100 : null,
      finish: p && vorWeeks > 0 ? finishById.get(p.id) ?? ranked.length + 1 : null,
      par: !r.is_keeper && ranked[Number(r.overall_pick) - 1] ? Math.round(ranked[Number(r.overall_pick) - 1].vor * 100) / 100 : null,
      surplus: null,
      outscoredBy: 0,
      outscored: 0,
    };
  });
  for (const x of picks) if (!x.keeper && x.vor != null && x.par != null) x.surplus = Math.round((x.vor - x.par) * 100) / 100;
  const nk = picks.filter((y) => !y.keeper && y.vor != null);
  for (const x of nk) {
    x.outscoredBy = nk.filter((y) => y.overall > x.overall && y.vor! > x.vor!).length;
    x.outscored = nk.filter((y) => y.overall < x.overall && y.vor! < x.vor!).length;
  }
  const basis = tiers ? `${tiers.basis === "this season" ? "This season's" : "Last season's"} league cutoffs (${tiers.gamesPlayed} GP in)` : "Tier cutoffs unavailable";
  return { season, source, basis, vorWeeks, picks };
}
