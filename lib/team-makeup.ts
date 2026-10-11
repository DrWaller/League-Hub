// Server-side only. Team makeup: every rostered player rated by tier (Stream, Depth, Elite, Superstar,
// Franchise) with his last-30-day form, and a keep / watch / drop signal. Built for deciding who on a roster
// is worth keeping and who can go.
//
// Rating = the player's average points per game this season pulled toward last season's average (so the first
// few games don't swing it), compared with the league's frozen cutoffs (lib/league-tiers.ts).
// Form = his last 30 days against the same cutoffs.

import { getLeagueMeta, getStandings } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { fetchRosterDay } from "@/lib/games-played";
import { getBestAvailable, NHL_ABBREV } from "@/lib/best-available";
import { getLeagueTiers, loadPools, tierOf, tierRank, type LeagueTiers, type Tier } from "@/lib/league-tiers";
import type { Group } from "@/lib/radar";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;
const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const GROUP_OF: Record<number, Group> = { 1: "F", 2: "F", 3: "F", 4: "D", 5: "G" };
const K_SKATER = 15; // games of last season's average blended into the rating
const K_GOALIE = 10;

export type Signal = "Core" | "Keep" | "Watch" | "Drop candidate" | "IR" | "Unrated";

export interface MakeupPlayer {
  id: number;
  name: string;
  pos: string;
  group: Group;
  nhl: string;
  slot: "IR" | "Bench" | "Lineup";
  injury: string | null;
  gp: number;
  avg: number | null; // this season
  priorAvg: number | null; // last season (20+ games)
  est: number | null; // the rating: this season blended with last
  tier: Tier | null;
  l30: { gp: number; avg: number } | null;
  form: Tier | null; // tier of his last 30 days (needs a few games)
  trend: "up" | "down" | null; // form is a tier or more above / below his rating
  signal: Signal;
  why: string;
  better: { id: number; name: string; est: number; tier: Tier; team: string } | null; // best free agent at his position who beats him
}

export interface MakeupTeam {
  id: number;
  name: string;
  players: MakeupPlayer[];
  counts: Record<Tier, number>; // non-IR players
}

export interface TeamMakeup {
  tiers: LeagueTiers;
  teams: MakeupTeam[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function fetchWindows(ids: number[], season: number): Promise<Map<number, any[]>> {
  const out = new Map<number, any[]>();
  if (ids.length === 0) return out;
  const filter = { players: { filterIds: { value: ids }, filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: [`00${season}`, `03${season}`] }, limit: ids.length + 20 } };
  try {
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=kona_player_info`, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`, "x-fantasy-filter": JSON.stringify(filter) },
      next: { revalidate: 600 },
    });
    if (!res.ok) return out;
    const data = await res.json();
    for (const e of data?.players ?? []) {
      const pl = e?.player;
      if (pl?.id != null && Array.isArray(pl.stats)) out.set(pl.id, pl.stats);
    }
  } catch {
    /* falls back to the roster's own season stats */
  }
  return out;
}

function windowOf(stats: any[], prefix: string, season: number): { gp: number; avg: number } | null {
  const x = stats.find((s) => s.statSourceId === 0 && String(s.id) === `${prefix}${season}`);
  if (!x) return null;
  const pts = Number(x.appliedTotal);
  let gp = Number(x.stats?.["34"]) || Number(x.stats?.["0"]) || 0;
  const avg = Number(x.appliedAverage);
  if (!gp && avg > 0 && Number.isFinite(pts)) gp = Math.round(pts / avg);
  if (!Number.isFinite(pts) || gp <= 0) return null;
  return { gp, avg: pts / gp };
}

export async function getTeamMakeup(): Promise<TeamMakeup | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const [tiers, status, standings, pools, fa] = await Promise.all([
    getLeagueTiers(),
    getCurrentScoringPeriod(),
    getStandings(),
    loadPools(season - 1, false),
    getBestAvailable().catch(() => null),
  ]);
  if (!tiers || status.current === null) return null;
  const roster = await fetchRosterDay(season, status.current, false);
  if (!roster?.teams) return null;

  const prior = new Map<number, { gp: number; avg: number }>();
  for (const g of ["F", "D", "G"] as Group[]) for (const p of pools[g]) if (p.gp > 0) prior.set(p.id, { gp: p.gp, avg: p.appliedTotal / p.gp });

  const ids: number[] = [];
  for (const t of roster.teams) for (const e of t.roster?.entries ?? []) if (e.playerPoolEntry?.player?.id != null) ids.push(e.playerPoolEntry.player.id);
  const windows = await fetchWindows(ids, season);

  // Free agents rated the same way (this season pulled toward ESPN's projection), best first, by group.
  const faRated: Record<Group, { id: number; name: string; est: number; tier: Tier; team: string }[]> = { F: [], D: [], G: [] };
  if (fa) {
    for (const p of fa.players) {
      const g: Group = p.position === "G" ? "G" : p.position === "D" ? "D" : "F";
      const s = p.w.season;
      const k = g === "G" ? K_GOALIE : K_SKATER;
      const base = p.proj ?? tiers.cutoffs[g].depth - 0.1;
      const est = s && s.gp > 0 ? (s.gp * s.avg + k * base) / (s.gp + k) : null;
      const tier = est === null ? null : tierOf(est, tiers.cutoffs[g]);
      if (est !== null && tier) faRated[g].push({ id: p.id, name: p.name, est: r2(est), tier, team: p.team });
    }
    for (const g of ["F", "D", "G"] as Group[]) faRated[g].sort((a, b) => b.est - a.est);
  }

  const names = new Map(standings.teams.map((t) => [t.id, t.name] as const));
  const teams: MakeupTeam[] = [];
  for (const t of roster.teams) {
    const players: MakeupPlayer[] = [];
    for (const e of t.roster?.entries ?? []) {
      const pl = e.playerPoolEntry?.player;
      const posId = Number(pl?.defaultPositionId);
      if (!pl || !POS[posId]) continue;
      const group = GROUP_OF[posId];
      const cut = tiers.cutoffs[group];
      const stats: any[] = windows.get(pl.id) ?? pl.stats ?? [];
      const cur = windowOf(stats, "00", season);
      const l30 = windowOf(stats, "03", season);
      const pr = prior.get(pl.id);
      const priorAvg = pr && pr.gp >= 20 ? pr.avg : null;
      const k = group === "G" ? K_GOALIE : K_SKATER;
      let est: number | null = null;
      if (cur && priorAvg !== null) est = (cur.gp * cur.avg + k * priorAvg) / (cur.gp + k);
      else if (cur && cur.gp >= 5) est = cur.avg;
      else if (priorAvg !== null) est = priorAvg;
      const tier = tierOf(est, cut);
      const minForm = group === "G" ? 3 : 5;
      const form = l30 && l30.gp >= minForm ? tierOf(l30.avg, cut) : null;
      const diff = tier && form ? tierRank(form) - tierRank(tier) : 0;
      const trend = diff >= 1 ? "up" : diff <= -1 ? "down" : null;
      const slot = e.lineupSlotId === 8 ? "IR" : e.lineupSlotId === 7 ? "Bench" : "Lineup";
      const inj = String(pl.injuryStatus ?? "ACTIVE");

      let signal: Signal;
      let why: string;
      if (slot === "IR") {
        signal = "IR";
        why = "On injured reserve";
      } else if (!tier) {
        signal = "Unrated";
        why = "No games yet this season or last";
      } else if (tierRank(tier) >= 2) {
        signal = "Core";
        why = `${tier}: a player you build around`;
      } else if (tier === "Depth") {
        if (form === "Stream" && l30 && l30.avg < cut.depth - 0.3) {
          signal = "Watch";
          why = `Depth, but ${r2(l30.avg)} over his last ${l30.gp} games`;
        } else {
          signal = "Keep";
          why = "Depth: starter level for this league";
        }
      } else if (form && tierRank(form) >= 1) {
        signal = "Watch";
        why = `Rated Stream, but his last ${l30!.gp} games are ${form} level (${r2(l30!.avg)})`;
      } else {
        signal = "Drop candidate";
        why = `Stream: below the starter line (${cut.depth.toFixed(2)})`;
      }

      let better: MakeupPlayer["better"] = null;
      if ((signal === "Drop candidate" || signal === "Watch") && est !== null) {
        const f = faRated[group].find((x) => x.est > est! + 0.05 && tierRank(x.tier) >= 1);
        if (f) better = f;
      }

      players.push({
        id: pl.id,
        name: pl.fullName ?? "Player",
        pos: POS[posId],
        group,
        nhl: NHL_ABBREV[Number(pl.proTeamId)] ?? "",
        slot,
        injury: inj === "ACTIVE" ? null : inj.replace(/_/g, " ").toLowerCase(),
        gp: cur?.gp ?? 0,
        avg: cur ? r2(cur.avg) : null,
        priorAvg: priorAvg === null ? null : r2(priorAvg),
        est: est === null ? null : r2(est),
        tier,
        l30: l30 ? { gp: l30.gp, avg: r2(l30.avg) } : null,
        form,
        trend,
        signal,
        why,
        better,
      });
    }
    players.sort((a, b) => (a.group === b.group ? (b.est ?? -1) - (a.est ?? -1) : ["F", "D", "G"].indexOf(a.group) - ["F", "D", "G"].indexOf(b.group)));
    const counts: Record<Tier, number> = { Franchise: 0, Superstar: 0, Elite: 0, Depth: 0, Stream: 0 };
    for (const p of players) if (p.slot !== "IR" && p.tier) counts[p.tier]++;
    teams.push({ id: t.id, name: names.get(t.id) ?? `Team ${t.id}`, players, counts });
  }
  teams.sort((a, b) => a.name.localeCompare(b.name));
  return { tiers, teams };
}

// ---------------------------------------------------------------------------------------------
// Every player in the league by tier: the rostered players from the team makeup, plus the free agents and
// waiver players, so "show me all the Franchise players" has one answer whoever owns them.
export interface DirPlayer {
  id: number;
  name: string;
  pos: string;
  group: Group;
  nhl: string;
  owner: string | null; // fantasy team, or null for a free agent / waivers
  status: "Rostered" | "Free agent" | "Waivers";
  injury: string | null;
  gp: number;
  avg: number | null;
  priorAvg: number | null;
  est: number | null;
  tier: Tier | null;
  l30: { gp: number; avg: number } | null;
  form: Tier | null;
  trend: "up" | "down" | null;
}

export interface TierDirectory {
  tiers: LeagueTiers;
  players: DirPlayer[];
}

export async function getTierDirectory(): Promise<TierDirectory | null> {
  const meta = await getLeagueMeta();
  const [makeup, fa, pools] = await Promise.all([getTeamMakeup(), getBestAvailable().catch(() => null), loadPools(meta.season - 1, false)]);
  if (!makeup) return null;
  const { tiers } = makeup;
  const out: DirPlayer[] = [];
  for (const t of makeup.teams) {
    for (const p of t.players) {
      out.push({ id: p.id, name: p.name, pos: p.pos, group: p.group, nhl: p.nhl, owner: t.name, status: "Rostered", injury: p.injury, gp: p.gp, avg: p.avg, priorAvg: p.priorAvg, est: p.est, tier: p.tier, l30: p.l30, form: p.form, trend: p.trend });
    }
  }
  if (fa) {
    const prior = new Map<number, { gp: number; avg: number }>();
    for (const g of ["F", "D", "G"] as Group[]) for (const p of pools[g]) if (p.gp > 0) prior.set(p.id, { gp: p.gp, avg: p.appliedTotal / p.gp });
    const seen = new Set(out.map((p) => p.id));
    for (const p of fa.players) {
      if (seen.has(p.id)) continue;
      const group: Group = p.position === "G" ? "G" : p.position === "D" ? "D" : "F";
      const cut = tiers.cutoffs[group];
      const s = p.w.season;
      const pr = prior.get(p.id);
      const priorAvg = pr && pr.gp >= 20 ? pr.avg : null;
      const k = group === "G" ? K_GOALIE : K_SKATER;
      let est: number | null = null;
      if (s && s.gp > 0 && priorAvg !== null) est = (s.gp * s.avg + k * priorAvg) / (s.gp + k);
      else if (s && s.gp >= 5) est = s.avg;
      else if (priorAvg !== null) est = priorAvg;
      const tier = tierOf(est, cut);
      const l30 = p.w.l30 && p.w.l30.gp > 0 ? { gp: p.w.l30.gp, avg: p.w.l30.avg } : null;
      const form = l30 && l30.gp >= (group === "G" ? 3 : 5) ? tierOf(l30.avg, cut) : null;
      const diff = tier && form ? tierRank(form) - tierRank(tier) : 0;
      out.push({
        id: p.id,
        name: p.name,
        pos: p.position,
        group,
        nhl: p.team,
        owner: null,
        status: p.status === "W" ? "Waivers" : "Free agent",
        injury: p.injury,
        gp: s?.gp ?? 0,
        avg: s && s.gp > 0 ? r2(s.avg) : null,
        priorAvg: priorAvg === null ? null : r2(priorAvg),
        est: est === null ? null : r2(est),
        tier,
        l30,
        form,
        trend: diff >= 1 ? "up" : diff <= -1 ? "down" : null,
      });
    }
  }
  out.sort((a, b) => (b.est ?? -1) - (a.est ?? -1));
  return { tiers, players: out.filter((p) => p.tier !== null) };
}
