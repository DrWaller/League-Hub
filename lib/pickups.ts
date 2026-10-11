// Server-side only. The pickup optimizer: which available player adds the most points to MY lineup.
//
// Every day, a team fills its starting slots with the best of its players who have a game that day.
// On a light NHL day (few teams playing) some slots go empty, so a free agent whose team plays that day
// adds his full expected points; on a heavy day he only adds what he's worth over the worst starter.
// The value of a pickup is the extra points over the next N days, with the best player to drop.
//
// Expected points per game = the player's season average pulled toward ESPN's projection (or replacement
// level if there's none) like the win-probability model does, so one hot week doesn't fool it. Players who
// are simply performing at a level that stands out are flagged "can't miss" whatever the schedule says.

import { getLeagueMeta, getScoringPeriodsForWeek, getStandings } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { fetchProSchedule, fetchRosterAgg, fetchRosterDay } from "@/lib/games-played";
import { fetchLineupSlots, SLOT, type Pos } from "@/lib/vor";
import { getBestAvailable, type AvailablePlayer } from "@/lib/best-available";
import { getNhlUsage, type Usage } from "@/lib/nhl-usage";
import { getLines, norm as normName, ESPN_TO_NHL } from "@/lib/lines";
import { describeChange, recentChanges, syncLines } from "@/lib/lines-store";

const POS_BY_ID: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const K_SKATER = 15;
const K_GOALIE = 10;
const GOALIE_START = 0.6; // a goalie's team plays more games than he starts
const MAX_CANDIDATES = 90;
const SHOWN = 40;
const LIGHT_DAY_GAMES = 8; // Frozen Pool's default: a night with 8 or fewer NHL games is a light day

export interface PickupDay {
  offset: number;
  label: string;
  nhlGames: number; // NHL games that night (league-wide)
  open: number; // empty starting slots on my team that day
  light: boolean;
}

export interface Pickup {
  id: number;
  name: string;
  position: Pos;
  team: string;
  status: "FA" | "W";
  owned: number | null;
  injury: string | null;
  est: number; // expected points per game
  games: number; // his team's games in the window
  lightGames: number; // of those, games on days my lineup has an open slot for him
  lightDayGames: number; // of those, games on league light days (few NHL games that night)
  added: number; // extra points over the window if I had a free roster spot
  net: number; // extra points after dropping the best drop
  drop: { id: number; name: string } | null;
  vorSeason: number | null;
  avgL15: number | null;
  gpL15: number;
  hot: string | null; // why he can't be missed, if he can't
  role: Usage | null; // how the NHL uses him (ice time, power play, line), null for goalies or no match
}

export interface PickupData {
  teamId: number;
  teamName: string;
  teams: { id: number; name: string }[];
  windowKey: PickupWindow;
  roleOn: boolean;
  hasRoles: boolean;
  windowLabel: string;
  dayCount: number;
  days: PickupDay[];
  picks: Pickup[];
  hot: Pickup[];
  lineChanges: { name: string; team: string; text: string; at: string; id: number | null; position: string | null }[]; // recent moves by players who are available
  linesUpdated: string | null;
  linesLive: boolean;
}

type P = { id: number; pos: Pos; v: number };

export type OpenSlots = Record<"C" | "LW" | "RW" | "F" | "D" | "G" | "UTIL", number>;

function bestLineup(players: P[], counts: Record<number, number>): { sum: number; filled: number; open: OpenSlots } {
  const sorted = [...players].sort((a, b) => b.v - a.v);
  const used = new Set<number>();
  let sum = 0;
  let filled = 0;
  const open = {} as OpenSlots;
  const take = (ok: (p: P) => boolean, n: number, key: keyof OpenSlots) => {
    let got = 0;
    for (const p of sorted) {
      if (got >= n) break;
      if (used.has(p.id) || !ok(p)) continue;
      used.add(p.id);
      sum += p.v;
      filled++;
      got++;
    }
    open[key] = Math.max(0, n - got);
  };
  take((p) => p.pos === "C", counts[SLOT.C] ?? 0, "C");
  take((p) => p.pos === "LW", counts[SLOT.LW] ?? 0, "LW");
  take((p) => p.pos === "RW", counts[SLOT.RW] ?? 0, "RW");
  take((p) => p.pos === "D", counts[SLOT.D] ?? 0, "D");
  take((p) => p.pos === "G", counts[SLOT.G] ?? 0, "G");
  take((p) => p.pos === "C" || p.pos === "LW" || p.pos === "RW", counts[SLOT.F] ?? 0, "F");
  take((p) => p.pos !== "G", counts[SLOT.UTIL] ?? 0, "UTIL");
  return { sum, filled, open };
}

const estimate = (pos: Pos, gp: number, avg: number, prior: number | null) => {
  if (prior === null) return gp > 0 ? avg : 0;
  const k = pos === "G" ? K_GOALIE : K_SKATER;
  return (gp * avg + k * prior) / (gp + k);
};
const dayValue = (pos: Pos, est: number) => Math.max(0, est) * (pos === "G" ? GOALIE_START : 1);

export type PickupWindow = "3d" | "current" | "next";

export async function getPickups(teamId: number | null, windowKey: PickupWindow, roleOn = true): Promise<PickupData | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const [standings, status, avail, counts, pro] = await Promise.all([
    getStandings(),
    getCurrentScoringPeriod(),
    getBestAvailable(),
    fetchLineupSlots(season),
    fetchProSchedule(season),
  ]);
  const lines = await getLines().catch(() => null);
  if (lines) await syncLines(lines).catch(() => 0);
  const changes = await recentChanges(3).catch(() => []);
  const usage = await getNhlUsage(season, lines, changes).catch(() => null);
  const teams = standings.teams.map((t) => ({ id: t.id, name: t.name }));
  if (!avail || !counts || !pro || status.current === null) return null;
  const current = status.current;
  if (teamId === null || !teams.some((t) => t.id === teamId)) {
    return { teamId: 0, teamName: "", teams, windowKey, roleOn, hasRoles: usage !== null, windowLabel: "", dayCount: 0, days: [], picks: [], hot: [], lineChanges: [], linesUpdated: null, linesLive: lines !== null };
  }

  const [rosterData, agg] = await Promise.all([fetchRosterDay(season, current, false), fetchRosterAgg(season)]);
  const myTeam = (rosterData?.teams ?? []).find((t: any) => t.id === teamId);
  if (!myTeam) return null;

  const rates = avail.rates;
  const prior = (pos: Pos, proj: number | null) => proj ?? (rates ? rates[pos] : null);

  // My roster: expected points per game for each player who isn't on IR or out.
  type R = { id: number; name: string; pos: Pos; proTeam: number; v: number };
  const roster: R[] = [];
  for (const e of myTeam.roster?.entries ?? []) {
    if (e.lineupSlotId === 8) continue; // IR
    const pl = e.playerPoolEntry?.player;
    const pos = POS_BY_ID[pl?.defaultPositionId];
    if (!pl || !pos) continue;
    const inj = String(pl.injuryStatus ?? "ACTIVE");
    if (inj === "OUT" || inj === "INJURY_RESERVE") continue;
    const stats: any[] = [...(agg.get(pl.id) ?? []), ...(pl.stats ?? [])];
    const act = stats.find((x) => x.statSourceId === 0 && x.statSplitTypeId === 0 && (String(x.id) === `00${season}` || x.seasonId === season));
    const gp = Number(act?.stats?.["34"]) || Number(act?.stats?.["0"]) || 0;
    const avg = gp > 0 ? Number(act?.appliedTotal) / gp : 0;
    const pr = stats.find((x) => x.statSourceId === 1 && x.statSplitTypeId === 0 && !x.scoringPeriodId);
    const pg = Number(pr?.stats?.["34"]) || Number(pr?.stats?.["0"]) || 0;
    const proj = pr && pg > 0 && Number.isFinite(Number(pr.appliedTotal)) ? Number(pr.appliedTotal) / pg : null;
    const mine = pos === "G" || !roleOn ? null : usage?.lookup(pl.fullName ?? "") ?? null;
    roster.push({ id: pl.id, name: pl.fullName ?? "Player", pos, proTeam: Number(pl.proTeamId), v: dayValue(pos, estimate(pos, gp, Number.isFinite(avg) ? avg : 0, prior(pos, proj)) * (mine?.mult ?? 1)) });
  }

  const plays = (proTeam: number, d: number) => pro.get(proTeam)?.has(current + d) ?? false;
  // The days to look at: the next 3 days, what's left of this matchup, or all of next matchup.
  let offs: number[] = [0, 1, 2];
  let windowLabel = "the next 3 days";
  if (windowKey !== "3d") {
    const wk = windowKey === "current" ? meta.currentWeek : meta.currentWeek + 1;
    const periods = await getScoringPeriodsForWeek(wk).then((r) => r.periods).catch(() => [] as number[]);
    const got = periods.map((sp) => sp - current).filter((o) => o >= 0 && o < 21);
    if (got.length > 0) {
      offs = got;
      windowLabel = windowKey === "current" ? `the rest of matchup ${wk}` : `matchup ${wk}`;
    }
  }
  const dayRoster = (d: number, skip?: number): P[] =>
    roster.filter((r) => r.id !== skip && plays(r.proTeam, d)).map((r) => ({ id: r.id, pos: r.pos, v: r.v }));

  const totalSlots = [SLOT.C, SLOT.LW, SLOT.RW, SLOT.F, SLOT.D, SLOT.G, SLOT.UTIL].reduce((n, k) => n + (counts[k] ?? 0), 0);
  const baseDay: Record<number, number> = {};
  const openDay: Record<number, number> = {};
  for (const d of offs) {
    const b = bestLineup(dayRoster(d), counts);
    baseDay[d] = b.sum;
    openDay[d] = Math.max(0, totalSlots - b.filled);
  }
  const base = offs.reduce((a, d) => a + baseDay[d], 0);

  const days: PickupDay[] = avail.days
    .filter((d) => offs.includes(d.offset))
    .map((d) => {
      let n = 0;
      for (const set of Array.from(pro.values())) if (set.has(current + d.offset)) n++;
      return { offset: d.offset, label: d.label, nhlGames: Math.round(n / 2), open: openDay[d.offset] ?? 0, light: Math.round(n / 2) <= LIGHT_DAY_GAMES };
    });
  const lightOffsets = new Set(days.filter((d) => d.light).map((d) => d.offset));

  // Who can't be missed: top of the available pool by VOR over the season, last 15 days and last 7 days.
  const hotWhy = new Map<number, string>();
  const topBy = (win: "season" | "l15" | "l7", n: number, minGp: number, label: string) => {
    avail.players
      .filter((p) => (p.w[win]?.gp ?? 0) >= minGp && p.w[win]!.vor !== null)
      .sort((a, b) => (b.w[win]!.vor as number) - (a.w[win]!.vor as number))
      .slice(0, n)
      .forEach((p, i) => {
        if (!hotWhy.has(p.id)) hotWhy.set(p.id, `#${i + 1} available by ${label} VOR (${(p.w[win]!.vor as number) >= 0 ? "+" : ""}${(p.w[win]!.vor as number).toFixed(2)})`);
      });
  };
  topBy("season", 5, 3, "season");
  topBy("l15", 5, 3, "last-15-day");
  topBy("l7", 3, 2, "last-7-day");

  type Cand = { a: AvailablePlayer; est: number; v: number; role: Usage | null };
  const cands: Cand[] = avail.players
    .filter((a) => a.injury === null || a.injury === "day to day")
    .map((a) => {
      const s = a.w.season;
      const role = a.position === "G" ? null : usage?.lookup(a.name, a.team) ?? null;
      const est = estimate(a.position, s?.gp ?? 0, s?.avg ?? 0, prior(a.position, a.proj)) * (roleOn && role ? role.mult : 1);
      return { a, est, v: dayValue(a.position, est), role };
    });
  const pool = new Map<number, Cand>();
  [...cands].sort((x, y) => y.est - x.est).slice(0, MAX_CANDIDATES).forEach((c) => pool.set(c.a.id, c));
  for (const c of cands) if (hotWhy.has(c.a.id)) pool.set(c.a.id, c);

  const evaluate = (c: Cand): Pickup => {
    let added = 0;
    let games = 0;
    let lightGames = 0;
    let lightDayGames = 0;
    const gainDay: number[] = [];
    for (const d of offs) {
      const playsToday = c.a.games.includes(d);
      if (!playsToday) {
        gainDay.push(0);
        continue;
      }
      games++;
      if (lightOffsets.has(d)) lightDayGames++;
      const g = bestLineup([...dayRoster(d), { id: -1, pos: c.a.position, v: c.v }], counts).sum - baseDay[d];
      gainDay.push(g);
      added += g;
      if (c.v > 0 && g >= 0.85 * c.v) lightGames++;
    }
    // Best drop: the roster player whose loss costs the least over the window.
    let bestNet = -Infinity;
    let drop: Pickup["drop"] = null;
    for (const r of roster) {
      let tot = 0;
      for (const d of offs) {
        const lineup = dayRoster(d, r.id);
        if (c.a.games.includes(d)) lineup.push({ id: -1, pos: c.a.position, v: c.v });
        tot += bestLineup(lineup, counts).sum;
      }
      const net = tot - base;
      if (net > bestNet) {
        bestNet = net;
        drop = { id: r.id, name: r.name };
      }
    }
    const l15 = c.a.w.l15;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      id: c.a.id,
      name: c.a.name,
      position: c.a.position,
      team: c.a.team,
      status: c.a.status,
      owned: c.a.owned,
      injury: c.a.injury,
      est: r2(c.est),
      games,
      lightGames,
      lightDayGames,
      added: r2(added),
      net: r2(Number.isFinite(bestNet) ? bestNet : added),
      drop,
      vorSeason: c.a.w.season?.vor ?? null,
      avgL15: l15 && l15.gp > 0 ? l15.avg : null,
      gpL15: l15?.gp ?? 0,
      hot: hotWhy.get(c.a.id) ?? null,
      role: c.role,
    };
  };

  // Recent line moves by players who are available (the signal that a pickup is about to matter).
  const availByKey = new Map(avail.players.map((p) => [`${ESPN_TO_NHL[p.team] ?? p.team}|${normName(p.name)}`, p] as const));
  const lineChanges: PickupData["lineChanges"] = [];
  for (const c of changes) {
    const a = availByKey.get(`${c.team}|${c.player}`);
    if (!a) continue;
    lineChanges.push({ name: c.name, team: a.team, text: describeChange(c), at: c.changedAt, id: a.id, position: a.position });
    if (lineChanges.length >= 12) break;
  }

  const all = Array.from(pool.values()).map(evaluate);
  const picks = [...all].sort((a, b) => b.net - a.net || b.added - a.added).slice(0, SHOWN);
  const hot = all.filter((p) => p.hot).sort((a, b) => (b.vorSeason ?? 0) - (a.vorSeason ?? 0));
  return { teamId, teamName: teams.find((t) => t.id === teamId)?.name ?? "", teams, windowKey, roleOn, hasRoles: usage !== null, windowLabel, dayCount: offs.length, days, picks, hot, lineChanges, linesUpdated: lines?.updatedAt ?? null, linesLive: lines !== null };
}

// Which starting slots are empty on each of the given scoring days for one team.
// A slot is empty when none of the team's healthy players who have a game that night can fill it.
export async function getOpenSlots(teamId: number, periods: number[]): Promise<{ open: OpenSlots[]; teamName: string } | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const [standings, status, counts, pro] = await Promise.all([getStandings(), getCurrentScoringPeriod(), fetchLineupSlots(season), fetchProSchedule(season)]);
  if (!counts || !pro || status.current === null) return null;
  const current = status.current;
  const rosterData = await fetchRosterDay(season, current, false);
  const myTeam = (rosterData?.teams ?? []).find((t: any) => t.id === teamId);
  if (!myTeam) return null;
  const roster: { id: number; pos: Pos; proTeam: number }[] = [];
  for (const e of myTeam.roster?.entries ?? []) {
    if (e.lineupSlotId === 8) continue; // IR
    const pl = e.playerPoolEntry?.player;
    const pos = POS_BY_ID[pl?.defaultPositionId];
    if (!pl || !pos) continue;
    const inj = String(pl.injuryStatus ?? "ACTIVE");
    if (inj === "OUT" || inj === "INJURY_RESERVE") continue;
    roster.push({ id: pl.id, pos, proTeam: Number(pl.proTeamId) });
  }
  const open: OpenSlots[] = [];
  for (const day of periods) {
    const players: P[] = roster.filter((r) => pro.get(r.proTeam)?.has(day)).map((r) => ({ id: r.id, pos: r.pos, v: 1 }));
    open.push(bestLineup(players, counts).open);
  }
  return { open, teamName: standings.teams.find((t) => t.id === teamId)?.name ?? "" };
}
