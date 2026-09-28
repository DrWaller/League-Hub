// Luck Chart math. "All-play" means: every week, every team is compared
// against every OTHER team's score that week, not just its real opponent.
// That gives an "expected" record -- what you'd have gone if the schedule
// were perfectly fair -- to hold up against the actual record.

import { Matchup } from "./types";

export interface LuckRow {
  teamId: number;
  allPlayW: number;
  allPlayL: number;
  allPlayT: number;
  expWinPct: number;
  actW: number;
  actL: number;
  actT: number;
  actWinPct: number;
  diff: number; // actual win% minus expected win%, as a fraction (0.15 = +15 pts)
  medPts: number; // this team's median weekly score
  medVsLeague: number; // that median minus the league-wide median weekly score
  rank: number; // by expected win%
  rankChange: number | null; // places gained (+) or lost (-) vs. the week before; null in week 1
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function winPct(w: number, l: number, t: number): number {
  const games = w + l + t;
  return games > 0 ? (w + t * 0.5) / games : 0;
}

function computeThrough(matchups: Matchup[], throughWeek: number) {
  const finals = matchups.filter((m) => m.isFinal && m.week <= throughWeek);

  const scoresByWeek = new Map<number, Map<number, number>>();
  const teams = new Map<number, { w: number; l: number; t: number; scores: number[] }>();
  const ensure = (id: number) => {
    if (!teams.has(id)) teams.set(id, { w: 0, l: 0, t: 0, scores: [] });
    return teams.get(id)!;
  };

  for (const m of finals) {
    if (!scoresByWeek.has(m.week)) scoresByWeek.set(m.week, new Map());
    scoresByWeek.get(m.week)!.set(m.homeTeamId, m.homeScore);
    scoresByWeek.get(m.week)!.set(m.awayTeamId, m.awayScore);

    const home = ensure(m.homeTeamId);
    const away = ensure(m.awayTeamId);
    home.scores.push(m.homeScore);
    away.scores.push(m.awayScore);
    if (m.homeScore > m.awayScore) {
      home.w++;
      away.l++;
    } else if (m.awayScore > m.homeScore) {
      away.w++;
      home.l++;
    } else {
      home.t++;
      away.t++;
    }
  }

  const allPlay = new Map<number, { w: number; l: number; t: number }>();
  for (const id of teams.keys()) allPlay.set(id, { w: 0, l: 0, t: 0 });

  for (const weekScores of scoresByWeek.values()) {
    for (const [id, score] of weekScores) {
      for (const [otherId, otherScore] of weekScores) {
        if (otherId === id) continue;
        const rec = allPlay.get(id)!;
        if (score > otherScore) rec.w++;
        else if (score < otherScore) rec.l++;
        else rec.t++;
      }
    }
  }

  const leagueMedian = median(finals.flatMap((m) => [m.homeScore, m.awayScore]));

  const rows = Array.from(teams.entries()).map(([teamId, t]) => {
    const ap = allPlay.get(teamId)!;
    const expWinPct = winPct(ap.w, ap.l, ap.t);
    const actWinPct = winPct(t.w, t.l, t.t);
    const medPts = median(t.scores);
    return {
      teamId,
      allPlayW: ap.w,
      allPlayL: ap.l,
      allPlayT: ap.t,
      expWinPct,
      actW: t.w,
      actL: t.l,
      actT: t.t,
      actWinPct,
      diff: actWinPct - expWinPct,
      medPts,
      medVsLeague: medPts - leagueMedian,
    };
  });

  rows.sort((a, b) => b.expWinPct - a.expWinPct || b.medPts - a.medPts);
  return { rows, leagueMedian };
}

export function computeLuck(matchups: Matchup[], throughWeek: number) {
  const current = computeThrough(matchups, throughWeek);
  const previous = throughWeek > 1 ? computeThrough(matchups, throughWeek - 1) : null;

  const prevRank = new Map<number, number>();
  previous?.rows.forEach((r, i) => prevRank.set(r.teamId, i + 1));

  const rows: LuckRow[] = current.rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    rankChange: previous && prevRank.has(r.teamId) ? prevRank.get(r.teamId)! - (i + 1) : null,
  }));

  return { rows, leagueMedian: current.leagueMedian };
}
