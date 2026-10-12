// A custom power-rankings model, separate from whatever ESPN shows.
// The goal is "who are the strongest teams right now", not "who won last week",
// so it ignores schedule luck and margin of victory and leans on how much a
// team actually scores and how good its roster is. Four signals:
//
//   1. All-play win %   (every week, how often a team beats EVERY other team's
//                        score, so a soft or brutal matchup doesn't matter)
//   2. Points scored    (average weekly fantasy points)
//   3. Roster strength  (value over replacement of the team's best lineup --
//                        a forward-looking read on the roster itself)
//   4. Actual win %     (a small bump for really winning matchups)
//
// Every signal is recency-weighted: a week counts RECENCY times as much as the
// week after it, so a team that has fixed its lineup climbs and a team that
// has gone cold falls. Weights are deliberately in one place and easy to tune.
// (/admin/formula-test backtests these signals against past seasons.)

import { Team, PowerRankingEntry, Matchup } from "./types";
import { regularSeasonFinals } from "./luck";

export const WEIGHTS = {
  allPlay: 0.35,
  ppg: 0.25,
  roster: 0.25,
  winPct: 0.15,
};

// How much a week counts relative to the week after it (0.8 = each week back
// is worth 80% of the one after it; roughly a 3-week half-life).
export const RECENCY = 0.8;

// How many of the most recent weeks of roster strength are blended in.
export const ROSTER_LOOKBACK = 4;

// week -> (fantasy team id -> that week's roster strength). Built server-side
// by lib/roster-strength.ts; optional, the ranking works without it.
export type WeeklyStrength = Map<number, Map<number, number>>;

const recencyWeight = (throughWeek: number, week: number) => RECENCY ** Math.max(0, throughWeek - week);

function zScores(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1; // avoid divide-by-zero when every team is level
  return values.map((v) => (v - mean) / sd);
}

export function calculatePowerRankings(
  teams: Team[],
  matchups: Matchup[],
  throughWeek: number,
  weeklyStrength?: WeeklyStrength
): PowerRankingEntry[] {
  const finals = regularSeasonFinals(matchups).filter((m) => m.week <= throughWeek);

  // Recency-weighted running totals per team.
  const acc = new Map<number, { w: number; win: number; pts: number; ap: number; apW: number }>();
  const get = (id: number) => {
    if (!acc.has(id)) acc.set(id, { w: 0, win: 0, pts: 0, ap: 0, apW: 0 });
    return acc.get(id)!;
  };

  const scoresByWeek = new Map<number, Map<number, number>>();
  for (const m of finals) {
    const wt = recencyWeight(throughWeek, m.week);
    const h = get(m.homeTeamId);
    const a = get(m.awayTeamId);
    h.w += wt;
    a.w += wt;
    h.pts += wt * m.homeScore;
    a.pts += wt * m.awayScore;
    const homeResult = m.homeScore > m.awayScore ? 1 : m.homeScore < m.awayScore ? 0 : 0.5;
    h.win += wt * homeResult;
    a.win += wt * (1 - homeResult);

    if (!scoresByWeek.has(m.week)) scoresByWeek.set(m.week, new Map());
    scoresByWeek.get(m.week)!.set(m.homeTeamId, m.homeScore);
    scoresByWeek.get(m.week)!.set(m.awayTeamId, m.awayScore);
  }

  // All-play: each week, the share of the other teams' scores a team beat.
  for (const [week, scores] of scoresByWeek) {
    const wt = recencyWeight(throughWeek, week);
    if (scores.size < 2) continue;
    for (const [id, score] of scores) {
      let beat = 0;
      for (const [otherId, other] of scores) {
        if (otherId === id) continue;
        beat += score > other ? 1 : score === other ? 0.5 : 0;
      }
      const r = get(id);
      r.ap += wt * (beat / (scores.size - 1));
      r.apW += wt;
    }
  }

  const ppgRaw = teams.map((t) => {
    const r = acc.get(t.id);
    return r && r.w > 0 ? r.pts / r.w : NaN;
  });
  const knownPpg = ppgRaw.filter((v) => !Number.isNaN(v));
  const meanPpg = knownPpg.length ? knownPpg.reduce((a, b) => a + b, 0) / knownPpg.length : 0;
  const ppg = ppgRaw.map((v) => (Number.isNaN(v) ? meanPpg : v));

  const winPct = teams.map((t) => {
    const r = acc.get(t.id);
    return r && r.w > 0 ? r.win / r.w : 0.5;
  });
  const allPlay = teams.map((t) => {
    const r = acc.get(t.id);
    return r && r.apW > 0 ? r.ap / r.apW : 0.5;
  });

  // Roster strength, recency-weighted over the last few weeks. Only used when
  // most teams have data, otherwise its weight is shared out among the rest.
  let roster: number[] | null = null;
  if (weeklyStrength) {
    const vals = teams.map((t) => {
      let sum = 0;
      let wsum = 0;
      for (const [week, byTeam] of weeklyStrength) {
        if (week > throughWeek || week <= throughWeek - ROSTER_LOOKBACK) continue;
        const v = byTeam.get(t.id);
        if (v === undefined) continue;
        const wt = recencyWeight(throughWeek, week);
        sum += wt * v;
        wsum += wt;
      }
      return wsum > 0 ? sum / wsum : NaN;
    });
    const known = vals.filter((v) => !Number.isNaN(v));
    if (known.length >= Math.ceil(teams.length / 2)) {
      const mean = known.reduce((a, b) => a + b, 0) / known.length;
      roster = vals.map((v) => (Number.isNaN(v) ? mean : v));
    }
  }

  const parts: { z: number[]; weight: number }[] = [
    { z: zScores(allPlay), weight: WEIGHTS.allPlay },
    { z: zScores(ppg), weight: WEIGHTS.ppg },
    { z: zScores(winPct), weight: WEIGHTS.winPct },
  ];
  if (roster) parts.push({ z: zScores(roster), weight: WEIGHTS.roster });
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);

  const scored = teams.map((t, i) => ({
    teamId: t.id,
    score: parts.reduce((s, p) => s + p.z[i] * p.weight, 0) / totalWeight,
    ppg: ppg[i],
  }));

  scored.sort((a, b) => b.score - a.score || b.ppg - a.ppg);

  return scored.map((s, i) => ({
    teamId: s.teamId,
    score: Math.round(s.score * 100) / 100,
    rank: i + 1,
  }));
}

// Rebuilds each team's regular-season record (and streak) using only games
// through `throughWeek`, straight from the weekly results. This is what lets
// the rankings be recomputed "as of last week" with nothing stored.
export function teamsThroughWeek(teams: Team[], matchups: Matchup[], throughWeek: number): Team[] {
  const finals = regularSeasonFinals(matchups)
    .filter((m) => m.week <= throughWeek)
    .sort((a, b) => a.week - b.week);

  const rec = new Map<number, { w: number; l: number; t: number; pf: number; pa: number; results: ("W" | "L" | "T")[] }>();
  const get = (id: number) => {
    if (!rec.has(id)) rec.set(id, { w: 0, l: 0, t: 0, pf: 0, pa: 0, results: [] });
    return rec.get(id)!;
  };

  for (const m of finals) {
    const h = get(m.homeTeamId);
    const a = get(m.awayTeamId);
    h.pf += m.homeScore;
    h.pa += m.awayScore;
    a.pf += m.awayScore;
    a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.w++;
      a.l++;
      h.results.push("W");
      a.results.push("L");
    } else if (m.awayScore > m.homeScore) {
      a.w++;
      h.l++;
      a.results.push("W");
      h.results.push("L");
    } else {
      h.t++;
      a.t++;
      h.results.push("T");
      a.results.push("T");
    }
  }

  return teams.map((t) => {
    const r = rec.get(t.id);
    if (!r) return { ...t, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, streak: undefined };
    const last = r.results[r.results.length - 1];
    let run = 0;
    for (let i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) run++;
    return {
      ...t,
      wins: r.w,
      losses: r.l,
      ties: r.t,
      pointsFor: r.pf,
      pointsAgainst: r.pa,
      streak: last === "W" || last === "L" ? `${last}${run}` : undefined,
    };
  });
}

// The week the rankings are "as of": the latest final regular-season week,
// or `maxWeek` if that is earlier (used by the newsletter).
export function rankingThroughWeek(matchups: Matchup[], maxWeek?: number): number {
  const latest = regularSeasonFinals(matchups).reduce((max, m) => Math.max(max, m.week), 0);
  return maxWeek ? Math.min(latest, maxWeek) : latest;
}

// Power rankings with week-over-week movement. Both the current ranking and
// the previous one are computed from the same weekly results (so the arrows
// always agree with the list). The "previous" ranking is the latest EARLIER
// week that actually has final games; if there isn't one (the first ranked
// week), there is no movement to show. Before any week is final, it falls
// back to a level, order-only ranking.
export function calculatePowerRankingsWithMovement(
  teams: Team[],
  matchups: Matchup[],
  maxWeek?: number, // rank "as of" this week instead of the latest final week (used by the newsletter)
  weeklyStrength?: WeeklyStrength
): { rankings: PowerRankingEntry[]; teams: Team[]; throughWeek: number } {
  const throughWeek = rankingThroughWeek(matchups, maxWeek);
  if (throughWeek === 0) return { rankings: calculatePowerRankings(teams, matchups, 0), teams, throughWeek: 0 };

  const currentTeams = teamsThroughWeek(teams, matchups, throughWeek);
  const rankings = calculatePowerRankings(currentTeams, matchups, throughWeek, weeklyStrength);

  const prevWeek = regularSeasonFinals(matchups).reduce((max, m) => (m.week < throughWeek ? Math.max(max, m.week) : max), 0);
  if (prevWeek > 0) {
    const prevTeams = teamsThroughWeek(teams, matchups, prevWeek);
    const prevRank = new Map(calculatePowerRankings(prevTeams, matchups, prevWeek, weeklyStrength).map((r) => [r.teamId, r.rank]));
    for (const r of rankings) r.previousRank = prevRank.get(r.teamId);
  }
  return { rankings, teams: currentTeams, throughWeek };
}
