// Server-side only. Team makeup: every rostered player rated by tier (Replacement, Depth, Good, Elite,
// Superstar) with his last-30-day form, and a keep / watch / drop signal. Built for deciding who on a roster
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
import { getSeasonGames, type SeasonGames } from "@/lib/season-games";
import { fetchLineupSlots } from "@/lib/vor";
import { getGoalieUsage } from "@/lib/goalie-starts";
import type { Group } from "@/lib/radar";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;
const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const GROUP_OF: Record<number, Group> = { 1: "F", 2: "F", 3: "F", 4: "D", 5: "G" };
const K_SKATER = 15; // games of last season's average blended into the rating
const K_GOALIE = 25; // goalie games are noisy, so last season counts for more
const K_SHARE = 25; // team games of last season's start share blended into this season's
const SHARE_CAP = 0.82; // even a workhorse sits some back-to-backs

// A goalie is rated on points per TEAM game: points per start (quality) x share of his team's starts (security).
export interface GoalieRating {
  perStart: number; // blended: this season pulled toward last (hard, since a goalie's start is noisy)
  share: number; // 0-1, share of his team's starts, pulled toward last season's and capped
  perTeamGame: number; // perStart x share: the number the tier is on
  pace: number; // projected fantasy-season total: points so far + his team's real games left x perTeamGame
  starts: number | null; // starts so far / his team's games (null when the NHL data had no match)
  teamGames: number | null;
  gamesLeft: number; // his team's games left in the fantasy regular season
}

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
  posRank: number | null; // 1 = best-rated player in the league at his exact position (C, LW, RW, D or G), owned or not
  posCount: number; // how many rated players share his position
  l30: { gp: number; avg: number } | null;
  form: Tier | null; // tier of his last 30 days (needs a few games)
  trend: "up" | "down" | null; // form is a tier or more above / below his rating
  signal: Signal;
  why: string;
  better: { id: number; name: string; est: number; tier: Tier; team: string } | null; // best free agent at his position who beats him
  goalie?: GoalieRating; // goalies only: est is points per team game
}

// How a roster grades against the rest of the league. Each player is worth his rating minus the league's starter
// line for his position (points per game above the line, so a starter below the line counts against the team).
// A team's starters are its best players at each position for the league's real lineup slots, whatever slot
// ESPN happens to show today (IR excluded); last season stays in the rating through the blend. The last-30-day
// line only adjusts a skater once it covers fewer games than his season (70% rating, 30% last 30 days), because
// before that it is just the season average counted twice. Team scores are then put on a 0-100 scale against the
// league (50 = average team, 15 points = one standard deviation).
export interface TeamRating {
  rating: number; // overall, 0-100 (50 = league average)
  grade: string; // A+ ... F, by how far above or below the league average
  rank: number; // 1 = strongest roster
  groups: Record<Group, number>; // same 0-100 scale, per position group
  strongest: Group;
  weakest: Group;
  holes: number; // counted starters rated Replacement
  note: string;
}

export interface MakeupTeam {
  id: number;
  name: string;
  players: MakeupPlayer[];
  counts: Record<Tier, number>; // non-IR players
  rating?: TeamRating;
}

export interface TeamMakeup {
  seasonGames: number; // games a team plays in the fantasy regular season (for goalie projections)
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


type Win = { gp: number; avg: number } | null;

// Rates goalies on points per team game. Start share is pulled toward last season's (so 5 starts in 5 games
// doesn't read as 100%) and capped. Injured goalies keep their season share (the last-10 share would collapse
// while they are out and drop the tier). The projected total is points so far plus his team's REAL games left
// in the fantasy regular season at that rate.
async function makeGoalieRater(season: number, leagueMaxGp: number) {
  const [cur, prev, sg] = await Promise.all([getGoalieUsage(season).catch(() => null), getGoalieUsage(season - 1).catch(() => null), getSeasonGames()]);
  const rate = (name: string, nhl: string, w: Win, priorAvg: number | null, injured: boolean, projBase: number | null): { est: number; info: GoalieRating } | null => {
    let perStart: number | null = null;
    if (w && w.gp > 0 && priorAvg !== null) perStart = (w.gp * w.avg + K_GOALIE * priorAvg) / (w.gp + K_GOALIE);
    else if (w && w.gp >= 3) perStart = w.avg;
    else if (priorAvg !== null) perStart = priorAvg;
    else if (projBase !== null) perStart = projBase;
    if (perStart === null) return null;
    const u = cur?.lookup(name, nhl) ?? null;
    const pu = prev?.lookup(name, nhl) ?? null;
    const priorShare = pu && pu.teamGames > 0 ? pu.starts / pu.teamGames : 0.5;
    let share: number;
    if (u && u.teamGames > 0) {
      const base = (u.starts + K_SHARE * priorShare) / (u.teamGames + K_SHARE);
      share = injured || u.games10 === 0 ? base : 0.5 * base + 0.5 * ((u.starts10 + 5 * base) / (u.games10 + 5));
    } else if (w && leagueMaxGp > 0) share = (w.gp + K_SHARE * priorShare) / (leagueMaxGp + K_SHARE);
    else share = priorShare;
    share = Math.max(0, Math.min(SHARE_CAP, share));
    const perTeamGame = perStart * share;
    const played = u?.teamGames ?? leagueMaxGp;
    const totalGames = sg?.total.get(nhl.toUpperCase()) ?? sg?.average ?? 82;
    const gamesLeft = Math.max(0, totalGames - played);
    const soFar = w ? w.gp * w.avg : 0;
    return {
      est: perTeamGame,
      info: { perStart: r2(perStart), share: r2(share), perTeamGame: r2(perTeamGame), pace: Math.round(soFar + gamesLeft * perTeamGame), starts: u?.starts ?? null, teamGames: u?.teamGames ?? null, gamesLeft },
    };
  };
  return { rate, seasonGames: sg?.average ?? 82 };
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
  const maxGp = Math.max(0, ...pools.G.map((g) => g.gp));
  const { rate: rateG, seasonGames } = await makeGoalieRater(season, Math.max(maxGp, ...Array.from(windows.values()).map((st) => windowOf(st, "00", season)?.gp ?? 0)));

  // Free agents rated the same way (this season pulled toward ESPN's projection), best first, by group.
  const faRated: Record<Group, { id: number; name: string; est: number; tier: Tier; team: string }[]> = { F: [], D: [], G: [] };
  // Every rated player's rating by exact position, rostered and free agents together, for the position rank.
  const ratingsByPos = new Map<string, number[]>();
  const addRating = (pos: string, est: number | null) => {
    if (est === null || !Number.isFinite(est)) return;
    const list = ratingsByPos.get(pos) ?? [];
    list.push(r2(est));
    ratingsByPos.set(pos, list);
  };
  if (fa) {
    for (const p of fa.players) {
      const g: Group = p.position === "G" ? "G" : p.position === "D" ? "D" : "F";
      const s = p.w.season;
      if (g === "G") {
        const pr = prior.get(p.id);
        const r = rateG(p.name, p.team, s, pr && pr.gp >= 20 ? pr.avg : null, !!p.injury, p.proj);
        if (r) {
          const tier = tierOf(r.est, tiers.cutoffs.G);
          if (tier) faRated.G.push({ id: p.id, name: p.name, est: r2(r.est), tier, team: p.team });
          addRating(p.position, r.est);
        }
        continue;
      }
      const k = K_SKATER;
      const base = p.proj ?? tiers.cutoffs[g].depth - 0.1;
      const est = s && s.gp > 0 ? (s.gp * s.avg + k * base) / (s.gp + k) : null;
      const tier = est === null ? null : tierOf(est, tiers.cutoffs[g]);
      if (est !== null && tier) faRated[g].push({ id: p.id, name: p.name, est: r2(est), tier, team: p.team });
      addRating(p.position, est);
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
      const injured = String(pl.injuryStatus ?? "ACTIVE") !== "ACTIVE";
      let goalie: GoalieRating | undefined;
      if (group === "G") {
        const r = rateG(pl.fullName ?? "", NHL_ABBREV[Number(pl.proTeamId)] ?? "", cur, priorAvg, injured, null);
        if (r) {
          est = r.est;
          goalie = r.info;
        } else est = null;
      }
      const tier = tierOf(est, cut);
      const minForm = group === "G" ? 3 : 5;
      const form = group === "G" ? null : l30 && l30.gp >= minForm ? tierOf(l30.avg, cut) : null;
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
        why = `${tier}: a player you build around${goalie ? ` (≈ ${goalie.pace} pts projected)` : ""}`;
      } else if (tier === "Depth") {
        if (form === "Replacement" && l30 && l30.avg < cut.depth - 0.3) {
          signal = "Watch";
          why = `Depth, but ${r2(l30.avg)} over his last ${l30.gp} games`;
        } else {
          signal = "Keep";
          why = goalie ? `Depth: starter level (≈ ${goalie.pace} pts projected)` : "Depth: starter level for this league";
        }
      } else if (form && tierRank(form) >= 1) {
        signal = "Watch";
        why = `Rated Replacement, but his last ${l30!.gp} games are ${form} level (${r2(l30!.avg)})`;
      } else {
        signal = "Drop candidate";
        why = `Replacement: below the starter line (${cut.depth.toFixed(2)}${group === "G" ? " per team game" : ""})`;
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
        posRank: null,
        posCount: 0,
        l30: l30 ? { gp: l30.gp, avg: r2(l30.avg) } : null,
        form,
        trend,
        signal,
        why,
        better,
        goalie,
      });
    }
    for (const p of players) addRating(p.pos, p.est);
    players.sort((a, b) => (a.group === b.group ? (b.est ?? -1) - (a.est ?? -1) : ["F", "D", "G"].indexOf(a.group) - ["F", "D", "G"].indexOf(b.group)));
    const counts: Record<Tier, number> = { Superstar: 0, Elite: 0, Good: 0, Depth: 0, Replacement: 0 };
    for (const p of players) if (p.slot !== "IR" && p.tier) counts[p.tier]++;
    teams.push({ id: t.id, name: names.get(t.id) ?? `Team ${t.id}`, players, counts });
  }
  for (const t of teams) {
    for (const p of t.players) {
      const all = ratingsByPos.get(p.pos);
      if (!all || p.est === null) continue;
      p.posCount = all.length;
      p.posRank = 1 + all.filter((x) => x > p.est!).length;
    }
  }
  await rateTeams(teams, tiers, season);
  teams.sort((a, b) => a.name.localeCompare(b.name));
  return { seasonGames, tiers, teams };
}

const GROUPS: Group[] = ["F", "D", "G"];
const GROUP_NAME: Record<Group, string> = { F: "forwards", D: "defence", G: "goaltending" };

// Points per game above the starter line for his position (null when he can't be counted: IR or unrated).
function valueOver(p: MakeupPlayer, line: number): number | null {
  if (p.slot === "IR" || p.est === null) return null;
  let v = p.est;
  if (p.group !== "G" && p.l30 && p.l30.gp >= 5 && p.l30.gp < p.gp) v = 0.7 * v + 0.3 * p.l30.avg;
  return v - line;
}

// How many starters per group the league's lineup has (ESPN slot ids: 0 C, 1 LW, 2 RW, 3 F, 4 D, 5 G, 6 Util).
// If the settings can't be read, the most players any team has in a non-bench slot stands in.
async function startingSlots(teams: MakeupTeam[], season: number): Promise<{ F: number; D: number; G: number; util: number }> {
  const c = await fetchLineupSlots(season).catch(() => null);
  if (c && (c[4] ?? 0) + (c[5] ?? 0) + (c[0] ?? 0) + (c[1] ?? 0) + (c[2] ?? 0) + (c[3] ?? 0) > 0) {
    return { F: (c[0] ?? 0) + (c[1] ?? 0) + (c[2] ?? 0) + (c[3] ?? 0), D: c[4] ?? 0, G: c[5] ?? 0, util: c[6] ?? 0 };
  }
  const most = (g: Group) => Math.max(0, ...teams.map((t) => t.players.filter((p) => p.group === g && p.slot === "Lineup").length));
  return { F: most("F"), D: most("D"), G: most("G"), util: 0 };
}

function gradeOf(z: number): string {
  const steps: [number, string][] = [[1.4, "A+"], [1.0, "A"], [0.65, "A-"], [0.35, "B+"], [0.1, "B"], [-0.1, "B-"], [-0.35, "C+"], [-0.65, "C"], [-1.0, "C-"], [-1.4, "D"]];
  for (const [min, g] of steps) if (z >= min) return g;
  return "F";
}

// Mean and standard deviation, with a floor so a league of near-identical teams doesn't blow up the scale.
function spread(xs: number[]): { mean: number; sd: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length || 1));
  return { mean, sd: Math.max(sd, 0.2) };
}

async function rateTeams(teams: MakeupTeam[], tiers: LeagueTiers, season: number): Promise<void> {
  if (teams.length === 0) return;
  const slots = await startingSlots(teams, season);
  const starterIds = new Map<number, Set<number>>(); // team id -> the players counted as starters
  const raw = teams.map((t) => {
    const g: Record<Group, number> = { F: 0, D: 0, G: 0 };
    const chosen = new Set<number>();
    const ranked = (grp: Group) =>
      t.players
        .filter((p) => p.group === grp)
        .map((p) => ({ p, v: valueOver(p, tiers.cutoffs[grp].depth) }))
        .filter((x): x is { p: MakeupPlayer; v: number } => x.v !== null)
        .sort((a, b) => b.v - a.v);
    const take = (list: { p: MakeupPlayer; v: number }[], n: number) => {
      for (const x of list.slice(0, Math.max(0, n))) {
        g[x.p.group] += x.v;
        chosen.add(x.p.id);
      }
    };
    take(ranked("F"), slots.F);
    take(ranked("D"), slots.D);
    take(ranked("G"), slots.G);
    // Util takes the best skater left over, forward or defence.
    take([...ranked("F"), ...ranked("D")].filter((x) => !chosen.has(x.p.id)).sort((a, b) => b.v - a.v), slots.util);
    starterIds.set(t.id, chosen);
    return { g, total: g.F + g.D + g.G };
  });
  const all = spread(raw.map((r) => r.total));
  const by: Record<Group, { mean: number; sd: number }> = { F: spread(raw.map((r) => r.g.F)), D: spread(raw.map((r) => r.g.D)), G: spread(raw.map((r) => r.g.G)) };
  const scaled = (v: number, s: { mean: number; sd: number }) => Math.round(Math.max(0, Math.min(100, 50 + (15 * (v - s.mean)) / s.sd)));
  const order = raw.map((r, i) => ({ i, total: r.total })).sort((a, b) => b.total - a.total);
  teams.forEach((t, i) => {
    const r = raw[i];
    const z = (r.total - all.mean) / all.sd;
    const groups = { F: scaled(r.g.F, by.F), D: scaled(r.g.D, by.D), G: scaled(r.g.G, by.G) };
    const sorted = [...GROUPS].sort((a, b) => groups[b] - groups[a]);
    const holes = t.players.filter((p) => starterIds.get(t.id)?.has(p.id) && p.tier === "Replacement").length;
    const strongest = sorted[0];
    const weakest = sorted[2];
    const top = t.counts.Superstar + t.counts.Elite;
    const note = `${top} Superstar/Elite ${top === 1 ? "player" : "players"}; strongest at ${GROUP_NAME[strongest]}, thinnest at ${GROUP_NAME[weakest]}${holes > 0 ? `; ${holes} Replacement-level in the lineup` : ""}`;
    t.rating = { rating: scaled(r.total, all), grade: gradeOf(z), rank: order.findIndex((o) => o.i === i) + 1, groups, strongest, weakest, holes, note };
  });
}

// ---------------------------------------------------------------------------------------------
// Every player in the league by tier: the rostered players from the team makeup, plus the free agents and
// waiver players, so "show me all the Superstar players" has one answer whoever owns them.
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
  goalie?: GoalieRating;
}

export interface TierDirectory {
  seasonGames: number;
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
      out.push({ id: p.id, name: p.name, pos: p.pos, group: p.group, nhl: p.nhl, owner: t.name, status: "Rostered", injury: p.injury, gp: p.gp, avg: p.avg, priorAvg: p.priorAvg, est: p.est, tier: p.tier, l30: p.l30, form: p.form, trend: p.trend, goalie: p.goalie });
    }
  }
  if (fa) {
    const prior = new Map<number, { gp: number; avg: number }>();
    for (const g of ["F", "D", "G"] as Group[]) for (const p of pools[g]) if (p.gp > 0) prior.set(p.id, { gp: p.gp, avg: p.appliedTotal / p.gp });
    const seen = new Set(out.map((p) => p.id));
    const maxGp = Math.max(0, ...fa.players.map((x) => x.w.season?.gp ?? 0), ...out.filter((x) => x.group === "G").map((x) => x.gp));
    const { rate: rateG } = await makeGoalieRater(meta.season, maxGp);
    for (const p of fa.players) {
      if (seen.has(p.id)) continue;
      const group: Group = p.position === "G" ? "G" : p.position === "D" ? "D" : "F";
      const cut = tiers.cutoffs[group];
      const s = p.w.season;
      const pr = prior.get(p.id);
      const priorAvg = pr && pr.gp >= 20 ? pr.avg : null;
      const k = K_SKATER;
      let est: number | null = null;
      let goalie: GoalieRating | undefined;
      if (group === "G") {
        const r = rateG(p.name, p.team, s, priorAvg, !!p.injury, null);
        if (r) {
          est = r.est;
          goalie = r.info;
        }
      } else if (s && s.gp > 0 && priorAvg !== null) est = (s.gp * s.avg + k * priorAvg) / (s.gp + k);
      else if (s && s.gp >= 5) est = s.avg;
      else if (priorAvg !== null) est = priorAvg;
      const tier = tierOf(est, cut);
      const l30 = p.w.l30 && p.w.l30.gp > 0 ? { gp: p.w.l30.gp, avg: p.w.l30.avg } : null;
      const form = group === "G" ? null : l30 && l30.gp >= 5 ? tierOf(l30.avg, cut) : null;
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
        goalie,
      });
    }
  }
  out.sort((a, b) => (b.est ?? -1) - (a.est ?? -1));
  return { seasonGames: makeup.seasonGames, tiers, players: out.filter((p) => p.tier !== null) };
}
