// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Games played and projected games for one matchup week, per fantasy team.
// ESPN doesn't show this; Yahoo does.
//
// A "game" is one starter-day: a player in an ACTIVE lineup slot (not bench / IR)
// on a day his NHL team plays.
//   - played    = the player has actual stats posted for that day (he got into the game)
//   - projected = today or a later day, no stats yet, his NHL team is scheduled to
//                 play, and he sits in an active slot in that day's saved lineup
// Lineups are read one scoring day at a time, so the projection reflects whatever
// lineup is currently saved for each remaining day.

import { getScoringPeriodsForWeek } from "@/lib/espn";
import { getWeekCalendar, periodsForWeek } from "@/lib/week-calendar";
import { bestDayLineup, fetchSlotCounts } from "@/lib/best-lineup";
import type { Pos } from "@/lib/vor";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

// Same two slots lib/espn.ts treats as non-scoring: 7 = Bench, 8 = IR.
const NON_ACTIVE_SLOTS = new Set([7, 8]);

export interface TeamGamesPlayed {
  played: number;
  projected: number | null; // null = couldn't load the NHL schedule, so no projection
  // Fantasy points the remaining projected starter-games should add, and how uncertain that is
  // (variance). null = no usable projections, so no win probability.
  expectedPts: number | null;
  variance: number | null;
}

// ---- Expected points per game (see getWeekGamesPlayed) ----
// Each player's rate is ESPN's projection (the day's own projection, else the season projection,
// else last season's per-game average) blended with this season's actual per-game average. The
// blend leans on the projection like K games of evidence, so the actuals take over as games pile up.
const K_SKATER = 15;
const K_GOALIE = 10;
// Hockey fantasy points are lumpy: variance of ONE game is roughly this many times the player's
// mean points per game (goalies swing far more than skaters). Estimates, not fitted to your league.
const GAME_VAR_PER_PT = { skater: 2.5, goalie: 6 };
// How wrong a player's true rate might be, as a fraction of it (shared across all his games).
const RATE_SD = 0.3;

interface RateAcc {
  teamId: number;
  isG: boolean;
  n: number; // remaining games this week in the lineup as it is saved today
  idealN: number; // remaining games in the ideal lineup (days after today)
  startP: number; // chance a goalie actually starts a team game (1 for skaters)
  dailySum: number;
  dailyCnt: number;
  staticPrior: number | null;
  ppgActual: number | null;
  gpActual: number;
}

const statGames = (x: any) => Number(x?.stats?.["34"]) || Number(x?.stats?.["0"]) || 0;
const perGame = (x: any) => {
  const g = statGames(x);
  const tot = Number(x?.appliedTotal);
  return g > 0 && Number.isFinite(tot) ? tot / g : null;
};

export type WeekGamesPlayed = Record<number, TeamGamesPlayed>;

function cookies() {
  return { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` };
}

// Roster for one scoring day. Days before today are frozen, so cache them long.
export async function fetchRosterDay(season: number, sp: number, frozen: boolean) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mRoster&view=mTeam&scoringPeriodId=${sp}`;
  try {
    const res = await fetch(url, { headers: cookies(), next: { revalidate: frozen ? 86400 : 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Season-level stat buckets (this season's actuals, ESPN's projection, last season) for every rostered
// player. ESPN only includes these when NO scoringPeriodId is asked for, so they come from their own call.
export async function fetchRosterAgg(season: number): Promise<Map<number, any[]>> {
  const out = new Map<number, any[]>();
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mRoster&view=mTeam`;
  try {
    const res = await fetch(url, { headers: cookies(), next: { revalidate: 300 } });
    if (!res.ok) return out;
    const data = await res.json();
    for (const t of data?.teams ?? []) {
      for (const e of t.roster?.entries ?? []) {
        const pl = e.playerPoolEntry?.player;
        if (pl?.id != null && Array.isArray(pl.stats)) out.set(pl.id, pl.stats);
      }
    }
  } catch {
    /* projections just fall back to whatever the daily roster carries */
  }
  return out;
}

// proTeamId -> the scoring days that NHL team plays. ESPN publishes this on the
// game-level (not league-level) endpoint under settings.proTeams[].proGamesByScoringPeriod.
export async function fetchProSchedule(season: number): Promise<Map<number, Set<number>> | null> {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`;
  try {
    const res = await fetch(url, { headers: cookies(), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const teams: any[] = data?.settings?.proTeams ?? [];
    const out = new Map<number, Set<number>>();
    for (const t of teams) {
      const games = t?.proGamesByScoringPeriod;
      if (!games || typeof games !== "object") continue;
      const days = new Set<number>();
      for (const [k, v] of Object.entries(games)) {
        if (Array.isArray(v) && v.length > 0 && Number.isFinite(Number(k))) days.add(Number(k));
      }
      out.set(Number(t.id), days);
    }
    return out.size > 0 ? out : null;
  } catch {
    return null;
  }
}

// Current season only. Returns null when ESPN isn't connected or the week's days
// can't be worked out, so the page can simply leave the numbers off.
export async function getWeekGamesPlayed(week: number, season: number): Promise<WeekGamesPlayed | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;

  let periods: number[];
  try {
    periods = (await getScoringPeriodsForWeek(week)).periods;
  } catch {
    return null;
  }
  if (periods.length === 0) return null;

  const status = await getCurrentScoringPeriod();
  const current = status.current;
  if (current === null) return null;

  // ESPN only lists days that already have points, so on a live week the days still to come (tomorrow's
  // lineups) are missing and would never count as "games left". Extend through the week's last day using
  // the saved week calendar; with none saved, assume a 7-day week (week 1 can be shorter, so skip it).
  try {
    const last = periods[periods.length - 1];
    const cal = await getWeekCalendar(season);
    const saved = cal ? periodsForWeek(cal.lengths, week) : null;
    let end = saved?.length ? saved[saved.length - 1] : week > 1 ? periods[0] + 6 : last;
    if (end > last && end - last <= 7) {
      for (let sp = last + 1; sp <= end; sp++) if (sp >= current) periods.push(sp);
    }
  } catch {
    /* keep the days ESPN gave */
  }

  const needsSchedule = periods.some((p) => p >= current);
  const [days, pro, agg, slots, usage] = await Promise.all([
    Promise.all(periods.map((sp) => fetchRosterDay(season, sp, sp < current).then((data) => ({ sp, data })))),
    needsSchedule ? fetchProSchedule(season) : Promise.resolve(null),
    needsSchedule ? fetchRosterAgg(season) : Promise.resolve(new Map<number, any[]>()),
    needsSchedule ? fetchSlotCounts(season) : Promise.resolve(null),
    // loaded on demand: goalie-starts leads back to this file through vor, so a top-level import would be circular
    needsSchedule ? import("@/lib/goalie-starts").then((m) => m.getGoalieUsage(season)).catch(() => null) : Promise.resolve(null),
  ]);

  if (!days.some((d) => d.data?.teams)) return null;

  const result: WeekGamesPlayed = {};
  const rates = new Map<string, RateAcc>();
  const projectionAvailable = !needsSchedule || pro !== null;
  // Days after today are projected with each team's BEST lineup (as if the owner sets it every day);
  // today and earlier keep the lineup as saved, since today's games may already be locked.
  const ideal = Boolean(slots) && slots!.C + slots!.LW + slots!.RW + slots!.F + slots!.D + slots!.G + slots!.Util > 0;
  const POS: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
  const dayPools = new Map<string, { teamId: number; players: { id: number; position: Pos; key: string }[] }>();

  const rateFor = (teamId: number, player: any, sp: number): RateAcc => {
    const key = `${teamId}:${player.id}`;
    let acc = rates.get(key);
    if (!acc) {
      const stats: any[] = [...(agg.get(player.id) ?? []), ...(player.stats ?? [])];
      const seasonActual = stats.find(
        (x) => x.statSourceId === 0 && x.statSplitTypeId === 0 && (String(x.id) === `00${season}` || x.seasonId === season)
      );
      const projSeason = stats.find((x) => x.statSourceId === 1 && x.statSplitTypeId === 0 && !x.scoringPeriodId);
      const lastSeason = stats.find(
        (x) => x.statSourceId === 0 && x.statSplitTypeId === 0 && (String(x.id) === `00${season - 1}` || x.seasonId === season - 1)
      );
      const isG = player.defaultPositionId === 5;
      let startP = 1;
      if (isG) {
        const u = usage?.lookup(String(player.fullName ?? ""));
        if (u && u.teamGames > 0) {
          const season_ = u.starts / u.teamGames;
          const recent = u.games10 > 0 ? u.starts10 / u.games10 : season_;
          startP = Math.min(0.95, Math.max(0.05, 0.4 * season_ + 0.6 * recent));
        } else {
          startP = 0.4;
        }
      }
      acc = {
        teamId,
        isG,
        n: 0,
        idealN: 0,
        startP,
        dailySum: 0,
        dailyCnt: 0,
        staticPrior: perGame(projSeason) ?? perGame(lastSeason),
        ppgActual: perGame(seasonActual),
        gpActual: statGames(seasonActual),
      };
      rates.set(key, acc);
    }
    const daily = (player.stats ?? []).find((x: any) => x.statSourceId === 1 && x.scoringPeriodId === sp);
    const dv = Number(daily?.appliedTotal);
    if (daily && Number.isFinite(dv)) {
      acc.dailySum += dv;
      acc.dailyCnt++;
    }
    return acc;
  };

  for (const { sp, data } of days) {
    for (const t of data?.teams ?? []) {
      const row = (result[t.id] ??= {
        played: 0,
        projected: projectionAvailable ? 0 : null,
        expectedPts: projectionAvailable ? 0 : null,
        variance: projectionAvailable ? 0 : null,
      });
      for (const e of t.roster?.entries ?? []) {
        const player = e.playerPoolEntry?.player;

        // Ideal-lineup days: every healthy rostered player whose NHL team plays is a candidate, bench included.
        if (ideal && sp > current && pro && row.projected !== null) {
          const pos = player ? POS[player.defaultPositionId] : undefined;
          if (!player || !pos || !pro.get(Number(player.proTeamId))?.has(sp)) continue;
          const status = String(player.injuryStatus ?? "");
          if (status === "OUT" || status === "INJURY_RESERVE") continue;
          rateFor(t.id, player, sp);
          const k = `${t.id}:${sp}`;
          const pool = dayPools.get(k) ?? { teamId: t.id, players: [] };
          pool.players.push({ id: player.id, position: pos, key: `${t.id}:${player.id}` });
          dayPools.set(k, pool);
          continue;
        }

        if (NON_ACTIVE_SLOTS.has(e.lineupSlotId)) continue;
        if (!player) continue;

        const hasStats = (player.stats ?? []).some((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
        if (hasStats) {
          row.played++;
        } else if (sp >= current && pro && row.projected !== null) {
          if (pro.get(Number(player.proTeamId))?.has(sp)) {
            row.projected++;
            rateFor(t.id, player, sp).n++;
          }
        }
      }
    }
  }

  // Turn each player's remaining games into expected points and variance for his team.
  if (projectionAvailable && rates.size > 0) {
    const priorOf = (a: RateAcc) => (a.dailyCnt > 0 ? a.dailySum / a.dailyCnt : a.staticPrior ?? a.ppgActual);
    const mean = (g: boolean) => {
      const v = [...rates.values()].filter((a) => a.isG === g).map(priorOf).filter((x): x is number => x != null && Number.isFinite(x));
      return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null;
    };
    const groupMean = { skater: mean(false), goalie: mean(true) };
    let usable = true;
    const exp: Record<number, number> = {};
    const vr: Record<number, number> = {};

    // Expected points in one game: his rate, pulled toward the prior until this season's games pile up.
    const rateOf = (a: RateAcc): number | null => {
      const prior = priorOf(a) ?? (a.isG ? groupMean.goalie : groupMean.skater);
      if (prior == null) return null;
      const k = a.isG ? K_GOALIE : K_SKATER;
      const ppg = a.gpActual > 0 && a.ppgActual != null ? (a.gpActual * a.ppgActual + k * prior) / (a.gpActual + k) : prior;
      return Math.max(ppg, 0);
    };

    // Set each team's best lineup for every day still to come, ranked by expected points that day
    // (a goalie's value is his rate times his chance of starting).
    for (const pool of dayPools.values()) {
      const scored = pool.players.map((x) => {
        const a = rates.get(x.key)!;
        const mu = rateOf(a);
        return { ...x, points: mu == null ? 0 : mu * a.startP };
      });
      const { chosen } = bestDayLineup(scored, slots!);
      const row = result[pool.teamId];
      for (const x of scored) {
        if (!chosen.has(x.id)) continue;
        rates.get(x.key)!.idealN++;
        if (row.projected !== null) row.projected++;
      }
    }

    for (const a of rates.values()) {
      const mu = rateOf(a);
      if (mu == null) {
        usable = false;
        break;
      }
      const perPt = a.isG ? GAME_VAR_PER_PT.goalie : GAME_VAR_PER_PT.skater;
      const effN = a.n + a.idealN * a.startP;
      exp[a.teamId] = (exp[a.teamId] ?? 0) + effN * mu;
      vr[a.teamId] =
        (vr[a.teamId] ?? 0) +
        a.n * perPt * mu +
        a.idealN * (a.startP * perPt * mu + a.startP * (1 - a.startP) * mu * mu) +
        (effN * RATE_SD * mu) ** 2;
    }

    for (const id of Object.keys(result)) {
      const row = result[Number(id)];
      row.expectedPts = usable ? exp[Number(id)] ?? 0 : null;
      row.variance = usable ? vr[Number(id)] ?? 0 : null;
    }
  }

  return result;
}
