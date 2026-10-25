// Manager versions of "Biggest Week" and "Biggest Month": a team's best single-week score, and its best
// total across a Monthly Period. Regular-season games that are final and count only.
import type { Matchup, MonthlyPeriod } from "./types";
import { regularSeasonFinals } from "./luck";

export interface TeamWeek {
  teamId: number;
  week: number;
  score: number;
  oppId: number;
  oppScore: number;
}

export function biggestTeamWeeks(matchups: Matchup[], limit = 5): TeamWeek[] {
  const out: TeamWeek[] = [];
  for (const m of regularSeasonFinals(matchups)) {
    out.push({ teamId: m.homeTeamId, week: m.week, score: m.homeScore, oppId: m.awayTeamId, oppScore: m.awayScore });
    out.push({ teamId: m.awayTeamId, week: m.week, score: m.awayScore, oppId: m.homeTeamId, oppScore: m.homeScore });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface TeamMonth {
  teamId: number;
  periodLabel: string;
  startWeek: number;
  endWeek: number;
  weeks: number; // finished weeks counted so far
  complete: boolean;
  points: number;
}

// Points over a Monthly Period. A month still in progress counts the weeks finished so far, so a complete month
// is only compared fairly with another complete month when the periods are the same length; the card marks it.
export function biggestTeamMonths(matchups: Matchup[], periods: MonthlyPeriod[], limit = 5): TeamMonth[] {
  const finals = regularSeasonFinals(matchups);
  const out: TeamMonth[] = [];
  for (const p of periods) {
    const inPeriod = finals.filter((m) => m.week >= p.startWeek && m.week <= p.endWeek);
    if (inPeriod.length === 0) continue;
    const through = Math.max(...inPeriod.map((m) => m.week));
    const by = new Map<number, { points: number; weeks: Set<number> }>();
    const add = (id: number, week: number, score: number) => {
      const cur = by.get(id) ?? { points: 0, weeks: new Set<number>() };
      cur.points += score;
      cur.weeks.add(week);
      by.set(id, cur);
    };
    for (const m of inPeriod) {
      add(m.homeTeamId, m.week, m.homeScore);
      add(m.awayTeamId, m.week, m.awayScore);
    }
    for (const [teamId, v] of by) {
      out.push({ teamId, periodLabel: p.label, startWeek: p.startWeek, endWeek: p.endWeek, weeks: v.weeks.size, complete: through >= p.endWeek, points: v.points });
    }
  }
  return out.sort((a, b) => b.points - a.points).slice(0, limit);
}
