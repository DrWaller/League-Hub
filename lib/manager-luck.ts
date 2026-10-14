// Consistency and luck for every manager, from the same regular-season games as the Records page. Pure logic.
//
// Luck: each week a team's score is compared with every other team's score ("all-play"). The all-play record is the
// record a perfectly fair schedule would have given, so actual wins minus all-play wins is how much the schedule
// helped (positive) or hurt (negative).
//
// Boom or bust: each week's score is compared with the league's scores that season (z score). A boom week is a
// score a standard deviation above the league average, a bust week a standard deviation below. Consistency is the
// spread of the manager's own weekly scores as a share of their average (smaller = steadier).

import { regularSeasonFinals } from "./luck";
import type { RecManager, RecSeason } from "./records";

export interface LuckSeason {
  season: number;
  teamName: string;
  actualWins: number;
  expectedWins: number; // all-play win share x games
  games: number;
  diff: number; // actual minus expected wins
}

export interface ManagerLuck {
  managerId: number;
  name: string;
  games: number;
  actualWins: number;
  expectedWins: number;
  luck: number; // actual minus expected wins over the career
  allPlayPct: number; // all-play win % (the record a fair schedule would give)
  actualPct: number;
  stolenWins: number; // won with a below-median score that week
  robbedLosses: number; // lost with an above-median score that week
  avg: number;
  spread: number; // standard deviation of weekly scores
  cv: number; // spread / avg
  boom: number; // boom weeks
  bust: number; // bust weeks
  boomPct: number;
  bustPct: number;
  highWeek: { season: number; week: number; score: number } | null;
  lowWeek: { season: number; week: number; score: number } | null;
  seasons: LuckSeason[]; // oldest first
}

export interface ManagerLuckReport {
  me: ManagerLuck | null;
  all: ManagerLuck[]; // everyone with enough games, for ranking
  consistencyRank: number; // 1 = steadiest
  luckRank: number; // 1 = luckiest
  ranked: number;
  style: "Boom or bust" | "Steady" | "In between" | null;
}

const MIN_GAMES = 20;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return xs.length ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) : 0;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) : 0;
};

export function buildManagerLuck(managerId: number, managers: RecManager[], seasons: RecSeason[]): ManagerLuckReport {
  const nameOf = new Map(managers.map((m) => [m.id, m.name]));
  type Acc = {
    scores: number[];
    actualWins: number;
    expectedWins: number;
    games: number;
    allW: number;
    allGames: number;
    stolen: number;
    robbed: number;
    boom: number;
    bust: number;
    high: ManagerLuck["highWeek"];
    low: ManagerLuck["lowWeek"];
    seasons: Map<number, LuckSeason>;
  };
  const acc = new Map<number, Acc>();
  const get = (id: number): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { scores: [], actualWins: 0, expectedWins: 0, games: 0, allW: 0, allGames: 0, stolen: 0, robbed: 0, boom: 0, bust: 0, high: null, low: null, seasons: new Map() };
      acc.set(id, a);
    }
    return a;
  };

  for (const s of [...seasons].sort((a, b) => a.season - b.season)) {
    const teamById = new Map(s.teams.map((t) => [t.id, t]));
    const finals = regularSeasonFinals(s.matchups);
    // every team-week score this season, by week
    const byWeek = new Map<number, { teamId: number; score: number; opp: number }[]>();
    const push = (week: number, teamId: number, score: number, opp: number) => {
      const arr = byWeek.get(week) ?? [];
      arr.push({ teamId, score, opp });
      byWeek.set(week, arr);
    };
    for (const m of finals) {
      push(m.week, m.homeTeamId, m.homeScore, m.awayScore);
      push(m.week, m.awayTeamId, m.awayScore, m.homeScore);
    }
    const everyScore = [...byWeek.values()].flat().map((x) => x.score);
    const lm = mean(everyScore);
    const ls = sd(everyScore) || 1;

    for (const [week, rows] of byWeek) {
      const med = median(rows.map((r) => r.score));
      for (const r of rows) {
        const mid = teamById.get(r.teamId)?.managerId;
        if (mid == null) continue;
        const a = get(mid);
        const others = rows.filter((o) => o !== r);
        const beat = others.filter((o) => r.score > o.score).length + others.filter((o) => r.score === o.score).length * 0.5;
        const won = r.score > r.opp ? 1 : r.score === r.opp ? 0.5 : 0;
        a.games++;
        a.scores.push(r.score);
        a.actualWins += won;
        a.expectedWins += others.length ? beat / others.length : 0;
        a.allW += beat;
        a.allGames += others.length;
        if (won === 1 && r.score < med) a.stolen++;
        if (won === 0 && r.score > med) a.robbed++;
        const z = (r.score - lm) / ls;
        if (z >= 1) a.boom++;
        if (z <= -1) a.bust++;
        if (!a.high || r.score > a.high.score) a.high = { season: s.season, week, score: r.score };
        if (!a.low || r.score < a.low.score) a.low = { season: s.season, week, score: r.score };
        const ss = a.seasons.get(s.season) ?? { season: s.season, teamName: teamById.get(r.teamId)?.name ?? "", actualWins: 0, expectedWins: 0, games: 0, diff: 0 };
        ss.actualWins += won;
        ss.expectedWins += others.length ? beat / others.length : 0;
        ss.games++;
        ss.diff = ss.actualWins - ss.expectedWins;
        a.seasons.set(s.season, ss);
      }
    }
  }

  const all: ManagerLuck[] = [...acc.entries()].map(([id, a]) => {
    const m = mean(a.scores);
    const spread = sd(a.scores);
    return {
      managerId: id,
      name: nameOf.get(id) ?? `Manager ${id}`,
      games: a.games,
      actualWins: a.actualWins,
      expectedWins: a.expectedWins,
      luck: a.actualWins - a.expectedWins,
      allPlayPct: a.allGames ? a.allW / a.allGames : 0,
      actualPct: a.games ? a.actualWins / a.games : 0,
      stolenWins: a.stolen,
      robbedLosses: a.robbed,
      avg: m,
      spread,
      cv: m ? spread / m : 0,
      boom: a.boom,
      bust: a.bust,
      boomPct: a.games ? a.boom / a.games : 0,
      bustPct: a.games ? a.bust / a.games : 0,
      highWeek: a.high,
      lowWeek: a.low,
      seasons: [...a.seasons.values()].sort((x, y) => x.season - y.season),
    };
  });

  const ranked = all.filter((x) => x.games >= MIN_GAMES);
  const me = all.find((x) => x.managerId === managerId) ?? null;
  const inRank = me && me.games >= MIN_GAMES;
  const consistencyRank = inRank ? 1 + ranked.filter((x) => x.cv < me!.cv).length : 0;
  const luckRank = inRank ? 1 + ranked.filter((x) => x.luck > me!.luck).length : 0;
  let style: ManagerLuckReport["style"] = null;
  if (inRank && ranked.length >= 4) {
    const third = Math.ceil(ranked.length / 3);
    style = consistencyRank > ranked.length - third ? "Boom or bust" : consistencyRank <= third ? "Steady" : "In between";
  }
  return { me, all: ranked, consistencyRank, luckRank, ranked: ranked.length, style };
}
