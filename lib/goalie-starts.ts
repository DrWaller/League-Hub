// Server-side only. Who is actually starting in goal: which available goalies are the starter, are taking
// over the job, or are in a timeshare, and how many starts to expect over a window.
//
// Source: the NHL stats API, one row per goalie per game (gamesStarted = 1 for the starter), so the real
// start history of every team is known from one request. The projection is a simple, readable model:
//   * a goalie's start chance comes from his share of his team's recent games (last 10, weighted to the last 5)
//   * a starter usually sits one end of a back-to-back, a backup usually gets the second night
//   * a takeover (2 starts in a row, or the incumbent missing the last 3 games) is trusted more than the share
// Starts that look like a normal backup start (second night of a back-to-back, someone else started the
// night before) are NOT counted as a sign of a takeover, since every backup gets those.

import { getBestAvailable, type AvailablePlayer } from "@/lib/best-available";
import { getLeagueMeta } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { ESPN_TO_NHL, norm } from "@/lib/lines";
import { resolveWindow, type PickupWindow } from "@/lib/windows";

const SEASON_ID = (season: number) => `${season - 1}${season}`;
const K_GOALIE = 10;
const LOOKBACK = 10;

type GameRow = { gameId: number; date: string; team: string; id: number; name: string; started: boolean };
type TeamGame = { gameId: number; date: string; starter: number | null; played: Set<number>; b2b2: boolean };

async function fetchGoalieGames(season: number, revalidate = 900): Promise<GameRow[] | null> {
  const exp = `gameTypeId=2 and seasonId=${SEASON_ID(season)}`;
  const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&limit=-1&sort=gameDate&cayenneExp=${encodeURIComponent(exp)}`;
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    const data = await res.json();
    return ((data?.data ?? []) as any[])
      .filter((r) => Number(r.gamesPlayed) > 0)
      .map((r) => ({
        gameId: Number(r.gameId),
        date: String(r.gameDate).slice(0, 10),
        team: String(r.teamAbbrev ?? "").toUpperCase(),
        id: Number(r.playerId),
        name: String(r.goalieFullName ?? ""),
        started: Number(r.gamesStarted) > 0,
      }));
  } catch {
    return null;
  }
}

const dayBefore = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);

function buildTeamLogs(rows: GameRow[]): Map<string, TeamGame[]> {
  const byTeam = new Map<string, Map<number, TeamGame>>();
  for (const r of rows) {
    const games = byTeam.get(r.team) ?? new Map<number, TeamGame>();
    const g = games.get(r.gameId) ?? { gameId: r.gameId, date: r.date, starter: null, played: new Set<number>(), b2b2: false };
    g.played.add(r.id);
    if (r.started) g.starter = r.id;
    games.set(r.gameId, g);
    byTeam.set(r.team, games);
  }
  const out = new Map<string, TeamGame[]>();
  for (const [team, games] of Array.from(byTeam.entries())) {
    const list = Array.from(games.values()).sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
    const dates = new Set(list.map((g) => g.date));
    for (const g of list) g.b2b2 = dates.has(dayBefore(g.date));
    out.set(team, list);
  }
  return out;
}

export type GoalieRole = "takeover" | "starter" | "timeshare" | "backup" | "early";

export interface StartDot {
  r: "S" | "R" | "-"; // started, relieved (played, didn't start), did not play
  b2b: boolean; // second night of a back-to-back
  date: string;
}

export interface ZeroGoalie {
  player: AvailablePlayer;
  role: GoalieRole;
  reason: string;
  dots: StartDot[]; // oldest -> newest, his team's last games
  starts: number;
  games: number; // team games in the lookback
  starts3: number; // starts in his team's last 3 games
  streak: number; // starts in a row up to the latest team game
  incumbent: { name: string; starts3: number; starts: number } | null; // the team's main goalie, if it isn't him
  nights: { offset: number; label: string; p: number; b2b: boolean }[]; // start chance on each night his team plays
  expStarts: number;
  estPerStart: number;
  expValue: number;
}

export interface ZeroGData {
  windowKey: PickupWindow;
  windowLabel: string;
  scheduleKnown: boolean;
  cats: import("@/lib/best-available").StatCat[];
  days: import("@/lib/best-available").BestAvailable["days"];
  goalies: ZeroGoalie[];
  asOf: string | null; // latest game date in the NHL data
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function getZeroG(windowKey: PickupWindow): Promise<ZeroGData | null> {
  const meta = await getLeagueMeta();
  const [avail, status, rows] = await Promise.all([getBestAvailable(), getCurrentScoringPeriod(), fetchGoalieGames(meta.season)]);
  if (!avail || !rows || rows.length === 0) return null;
  const current = status.current ?? 0;
  const { offs, label: windowLabel } = await resolveWindow(windowKey, avail.days, current, meta.currentWeek);
  const logs = buildTeamLogs(rows);
  const names = new Map<number, string>();
  for (const r of rows) names.set(r.id, r.name);
  const today = avail.days[0]?.date ?? new Date().toISOString().slice(0, 10);
  const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const rate = avail.rates?.G ?? null;

  // Match ESPN's available goalies to NHL ids by name (and team when two share a name).
  const byName = new Map<string, number[]>();
  for (const r of rows) {
    const k = norm(r.name);
    const arr = byName.get(k) ?? [];
    if (!arr.includes(r.id)) arr.push(r.id);
    byName.set(k, arr);
  }

  const goalies: ZeroGoalie[] = [];
  for (const p of avail.players) {
    if (p.position !== "G") continue;
    const team = ESPN_TO_NHL[p.team] ?? p.team;
    const log = logs.get(team);
    const ids = byName.get(norm(p.name)) ?? [];
    const id = ids.find((x) => log?.some((g) => g.played.has(x))) ?? ids[0];
    if (!log || log.length === 0) continue;

    const recent = log.slice(-LOOKBACK);
    const startedBy = (g: TeamGame) => g.starter;
    const dots: StartDot[] = recent.map((g) => ({
      r: id !== undefined && startedBy(g) === id ? "S" : id !== undefined && g.played.has(id) ? "R" : "-",
      b2b: g.b2b2,
      date: g.date,
    }));
    const starts = dots.filter((d) => d.r === "S").length;
    const n = recent.length;
    const last3 = recent.slice(-3);
    const starts3 = last3.filter((g) => id !== undefined && g.starter === id).length;
    let streak = 0;
    for (let i = recent.length - 1; i >= 0 && id !== undefined && recent[i].starter === id; i--) streak++;

    // A start that is just a backup taking the second night of a back-to-back isn't a sign of a bigger role.
    const signalStart = (g: TeamGame, i: number) => {
      if (id === undefined || g.starter !== id) return false;
      const prev = recent[i - 1] ?? log[log.length - recent.length + i - 1];
      return !(g.b2b2 && prev && prev.starter !== id);
    };
    const signal3 = last3.filter((g, i) => signalStart(g, recent.length - last3.length + i)).length;

    // The incumbent: the team's goalie with the most starts in the lookback who isn't him.
    const counts = new Map<number, { s: number; s3: number }>();
    for (const g of recent) {
      if (g.starter === null) continue;
      const c = counts.get(g.starter) ?? { s: 0, s3: 0 };
      c.s++;
      counts.set(g.starter, c);
    }
    for (const g of last3) if (g.starter !== null) counts.get(g.starter)!.s3++;
    let inc: ZeroGoalie["incumbent"] = null;
    let incTop = -1;
    for (const [gid, c] of Array.from(counts.entries())) {
      if (gid === id) continue;
      if (c.s > incTop) {
        incTop = c.s;
        inc = { name: names.get(gid) ?? "?", starts3: c.s3, starts: c.s };
      }
    }
    // The incumbent may have stopped starting altogether (injury): count his starts in the lookback, not just last 3.
    const incMissing = inc !== null && inc.starts >= 2 && inc.starts3 === 0 && last3.length === 3;

    const share = n > 0 ? starts / n : 0;
    const share5 = (() => {
      const l5 = recent.slice(-5);
      return l5.length ? l5.filter((g) => id !== undefined && g.starter === id).length / l5.length : 0;
    })();

    let role: GoalieRole;
    let reason: string;
    if (n < 3) {
      role = "early";
      reason = `${starts} of ${n} team games so far`;
    } else if (signal3 >= 2 || (streak >= 2 && signal3 >= 1)) {
      role = "takeover";
      reason = `${streak >= 2 ? `${streak} starts in a row` : `${starts3} of his team's last 3`}${inc && incMissing ? `; ${inc.name} has 0 of the last 3` : ""}`;
    } else if (incMissing && starts3 >= 1) {
      role = "takeover";
      reason = `Started ${starts3} of the last 3 while ${inc!.name} has 0`;
    } else if (starts >= 6 || share >= 0.6) {
      role = "starter";
      reason = `${starts} of his team's last ${n}`;
    } else if (share >= 0.3) {
      role = "timeshare";
      reason = `${starts} of his team's last ${n}`;
    } else {
      role = "backup";
      reason = `${starts} of his team's last ${n}`;
    }

    // Start chance per game, then adjusted for the second night of a back-to-back.
    let base = clamp(0.5 * share5 + 0.5 * share, 0.05, 0.9);
    if (role === "takeover") base = Math.max(base, incMissing ? 0.8 : 0.6);
    if (role === "starter") base = Math.max(base, 0.6);
    const sched = new Set(p.games);
    const teamPlayedYesterday = log[log.length - 1]?.date === dayBefore(today);
    const nights = avail.days
      .filter((d) => offs.includes(d.offset) && sched.has(d.offset))
      .map((d) => {
        const b2b = d.offset === 0 ? teamPlayedYesterday : sched.has(d.offset - 1);
        let pr = base;
        if (b2b) pr = role === "starter" || (role === "takeover" && incMissing) ? base * 0.5 : role === "takeover" ? base * 0.6 : Math.max(base, 0.6);
        return { offset: d.offset, label: d.label, p: Math.round(clamp(pr, 0, 0.95) * 100) / 100, b2b };
      });
    const expStarts = Math.round(nights.reduce((a, x) => a + x.p, 0) * 100) / 100;

    // Points per start: his average pulled toward ESPN's projection (or replacement level) so a hot week doesn't fool it.
    const s = p.w.season;
    const prior = p.proj ?? rate;
    const gp = s?.gp ?? 0;
    const avg = s?.avg ?? 0;
    const est = prior === null ? (gp > 0 ? avg : 0) : (gp * avg + K_GOALIE * prior) / (gp + K_GOALIE);
    const estPerStart = Math.round(Math.max(0, est) * 100) / 100;

    goalies.push({
      player: p,
      role,
      reason,
      dots,
      starts,
      games: n,
      starts3,
      streak,
      incumbent: inc && role !== "starter" ? inc : null,
      nights,
      expStarts,
      estPerStart,
      expValue: Math.round(expStarts * estPerStart * 100) / 100,
    });
  }

  return { windowKey, windowLabel, scheduleKnown: avail.scheduleKnown, cats: avail.cats, days: avail.days, goalies, asOf: asOf || null };
}

// ---------------------------------------------------------------------------------------------
// How many of his team's games each goalie has started (for tiers: points per team game).
export interface GoalieUsage {
  starts: number;
  teamGames: number; // his team's games so far
  starts10: number; // starts in his team's last 10 games
  games10: number;
}
export interface GoalieUsageIndex {
  lookup(name: string, espnTeam?: string): GoalieUsage | null;
  teamGames(name: string): number | null;
}

export async function getGoalieUsage(season: number): Promise<GoalieUsageIndex | null> {
  const current = season === (await getLeagueMeta()).season;
  const rows = await fetchGoalieGames(season, current ? 900 : 86400);
  if (!rows || rows.length === 0) return null;
  const logs = buildTeamLogs(rows);
  // Each goalie's latest team.
  const latest = new Map<number, { team: string; date: string; name: string }>();
  for (const r of rows) {
    const l = latest.get(r.id);
    if (!l || r.date >= l.date) latest.set(r.id, { team: r.team, date: r.date, name: r.name });
  }
  const byKey = new Map<string, GoalieUsage>();
  const byName = new Map<string, GoalieUsage[]>();
  const teamGamesByName = new Map<string, number>();
  for (const [id, l] of Array.from(latest.entries())) {
    const log = logs.get(l.team) ?? [];
    const last10 = log.slice(-LOOKBACK);
    const u: GoalieUsage = {
      starts: log.filter((g) => g.starter === id).length,
      teamGames: log.length,
      starts10: last10.filter((g) => g.starter === id).length,
      games10: last10.length,
    };
    byKey.set(`${norm(l.name)}|${l.team}`, u);
    const arr = byName.get(norm(l.name)) ?? [];
    arr.push(u);
    byName.set(norm(l.name), arr);
    teamGamesByName.set(norm(l.name), log.length);
  }
  return {
    lookup(name, espnTeam) {
      const n = norm(name);
      if (espnTeam) {
        const hit = byKey.get(`${n}|${ESPN_TO_NHL[espnTeam] ?? espnTeam}`);
        if (hit) return hit;
      }
      const arr = byName.get(n);
      return arr && arr.length === 1 ? arr[0] : null;
    },
    teamGames: (name) => teamGamesByName.get(norm(name)) ?? null,
  };
}
