// Backtests power-ranking formulas against real results. For every week of
// every past season, each formula ranks the teams using ONLY the games played
// before that week, then is scored on how often the higher-ranked team won the
// matchup that week. Pure logic (no network/database) so it can be tested.

import { Matchup } from "./types";
import { regularSeasonFinals } from "./luck";

export type Feat = "winPct" | "ppg" | "diffPg" | "streak" | "allPlay" | "recent3";
export const FEATS: Feat[] = ["winPct", "ppg", "diffPg", "streak", "allPlay", "recent3"];
export type Weights = Partial<Record<Feat, number>>;

export const FEAT_LABEL: Record<Feat, string> = {
  winPct: "Win %",
  ppg: "Points scored / game",
  diffPg: "Point diff / game",
  streak: "Streak",
  allPlay: "All-play win %",
  recent3: "Last-3-games scoring",
};

export interface SeasonInput {
  season: number;
  matchups: Matchup[];
}

interface Game {
  home: number;
  away: number;
  homeWon: 1 | 0 | 0.5;
}
interface Sample {
  season: number;
  week: number;
  z: Map<number, Record<Feat, number>>; // z-scored features per team, using only earlier games
  games: Game[];
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function zscore(values: number[]): number[] {
  const m = mean(values);
  const sd = Math.sqrt(mean(values.map((v) => (v - m) ** 2))) || 1;
  return values.map((v) => (v - m) / sd);
}

// One sample per (season, week >= 2): features from earlier weeks + that week's games.
export function buildSamples(seasons: SeasonInput[]): Sample[] {
  const samples: Sample[] = [];
  for (const s of seasons) {
    const finals = regularSeasonFinals(s.matchups);
    const weeks = Array.from(new Set(finals.map((m) => m.week))).sort((a, b) => a - b);

    for (const week of weeks) {
      if (week < 2) continue;
      const prior = finals.filter((m) => m.week < week);
      if (prior.length === 0) continue;

      const scores = new Map<number, number[]>(); // team -> scores in order
      const results = new Map<number, ("W" | "L" | "T")[]>();
      const pf = new Map<number, number>();
      const pa = new Map<number, number>();
      const push = <T,>(m: Map<number, T[]>, id: number, v: T) => m.set(id, [...(m.get(id) ?? []), v]);
      const add = (m: Map<number, number>, id: number, v: number) => m.set(id, (m.get(id) ?? 0) + v);

      for (const g of [...prior].sort((a, b) => a.week - b.week)) {
        push(scores, g.homeTeamId, g.homeScore);
        push(scores, g.awayTeamId, g.awayScore);
        add(pf, g.homeTeamId, g.homeScore);
        add(pf, g.awayTeamId, g.awayScore);
        add(pa, g.homeTeamId, g.awayScore);
        add(pa, g.awayTeamId, g.homeScore);
        const h = g.homeScore > g.awayScore ? "W" : g.homeScore < g.awayScore ? "L" : "T";
        const a = h === "W" ? "L" : h === "L" ? "W" : "T";
        push(results, g.homeTeamId, h);
        push(results, g.awayTeamId, a);
      }

      // All-play: each week, share of the other teams' scores that week a team beat.
      const apWins = new Map<number, number>();
      const apGames = new Map<number, number>();
      const byWeek = new Map<number, Map<number, number>>();
      for (const g of prior) {
        const wk = byWeek.get(g.week) ?? new Map<number, number>();
        wk.set(g.homeTeamId, g.homeScore);
        wk.set(g.awayTeamId, g.awayScore);
        byWeek.set(g.week, wk);
      }
      for (const wk of byWeek.values()) {
        for (const [id, sc] of wk) {
          for (const [oid, osc] of wk) {
            if (oid === id) continue;
            add(apGames, id, 1);
            add(apWins, id, sc > osc ? 1 : sc === osc ? 0.5 : 0);
          }
        }
      }

      const ids = Array.from(scores.keys());
      const raw = ids.map((id) => {
        const r = results.get(id)!;
        const sc = scores.get(id)!;
        const n = r.length;
        const w = r.filter((x) => x === "W").length;
        const t = r.filter((x) => x === "T").length;
        const last = r[n - 1];
        let run = 0;
        for (let i = n - 1; i >= 0 && r[i] === last; i--) run++;
        const signed = last === "W" ? run : last === "L" ? -run : 0;
        return {
          winPct: (w + t * 0.5) / n,
          ppg: pf.get(id)! / n,
          diffPg: (pf.get(id)! - pa.get(id)!) / n,
          streak: Math.max(-3, Math.min(3, signed)),
          allPlay: (apGames.get(id) ?? 0) > 0 ? apWins.get(id)! / apGames.get(id)! : 0.5,
          recent3: mean(sc.slice(-3)),
        } as Record<Feat, number>;
      });

      const zs = new Map<number, Record<Feat, number>>();
      const zcols = Object.fromEntries(FEATS.map((f) => [f, zscore(raw.map((r) => r[f]))])) as Record<Feat, number[]>;
      ids.forEach((id, i) => zs.set(id, Object.fromEntries(FEATS.map((f) => [f, zcols[f][i]])) as Record<Feat, number>));

      const games: Game[] = finals
        .filter((m) => m.week === week && zs.has(m.homeTeamId) && zs.has(m.awayTeamId) && m.homeScore !== m.awayScore)
        .map((m) => ({ home: m.homeTeamId, away: m.awayTeamId, homeWon: m.homeScore > m.awayScore ? 1 : 0 }));
      if (games.length) samples.push({ season: s.season, week, z: zs, games });
    }
  }
  return samples;
}

export interface Accuracy {
  correct: number;
  total: number;
  pct: number;
  early: { correct: number; total: number; pct: number }; // weeks 2-4
  late: { correct: number; total: number; pct: number }; // week 5+
}

const pctOf = (c: number, t: number) => (t > 0 ? c / t : 0);

export function evaluate(samples: Sample[], weights: Weights): Accuracy {
  let c = 0, t = 0, ec = 0, et = 0, lc = 0, lt = 0;
  for (const s of samples) {
    const score = (id: number) => FEATS.reduce((sum, f) => sum + (weights[f] ?? 0) * s.z.get(id)![f], 0);
    for (const g of s.games) {
      const h = score(g.home);
      const a = score(g.away);
      const hit = h === a ? 0.5 : (h > a) === (g.homeWon === 1) ? 1 : 0;
      c += hit;
      t++;
      if (s.week <= 4) {
        ec += hit;
        et++;
      } else {
        lc += hit;
        lt++;
      }
    }
  }
  return {
    correct: c,
    total: t,
    pct: pctOf(c, t),
    early: { correct: ec, total: et, pct: pctOf(ec, et) },
    late: { correct: lc, total: lt, pct: pctOf(lc, lt) },
  };
}

export const CURRENT_WEIGHTS: Weights = { winPct: 0.5, diffPg: 0.35, streak: 0.15 };

export const CANDIDATES: { name: string; weights: Weights }[] = [
  { name: "Current formula (win % 50 / point diff 35 / streak 15)", weights: CURRENT_WEIGHTS },
  { name: "Win % only", weights: { winPct: 1 } },
  { name: "Point differential only", weights: { diffPg: 1 } },
  { name: "Points scored per game only", weights: { ppg: 1 } },
  { name: "All-play win % only", weights: { allPlay: 1 } },
  { name: "Last-3-games scoring only", weights: { recent3: 1 } },
  { name: "Points scored 60 / last 3 games 40", weights: { ppg: 0.6, recent3: 0.4 } },
  { name: "All-play 50 / points scored 30 / last 3 games 20", weights: { allPlay: 0.5, ppg: 0.3, recent3: 0.2 } },
];

// Every mix of these features in quarter steps; returns the best few.
const GRID_FEATS: Feat[] = ["allPlay", "ppg", "recent3", "winPct", "streak"];

export function gridSearch(samples: Sample[]): { weights: Weights; acc: Accuracy }[] {
  const out: { weights: Weights; acc: Accuracy }[] = [];
  const steps = [0, 1, 2, 3, 4];
  const rec = (i: number, cur: number[]) => {
    if (i === GRID_FEATS.length) {
      const total = cur.reduce((a, b) => a + b, 0);
      if (total === 0) return;
      const weights: Weights = {};
      GRID_FEATS.forEach((f, k) => {
        if (cur[k] > 0) weights[f] = cur[k] / total;
      });
      out.push({ weights, acc: evaluate(samples, weights) });
      return;
    }
    for (const s of steps) rec(i + 1, [...cur, s]);
  };
  rec(0, []);
  return out.sort((a, b) => b.acc.pct - a.acc.pct);
}

// Honest check against overfitting: pick the best mix using half the seasons,
// score it on the other half (and vice versa).
export function holdoutTest(seasons: SeasonInput[]): { best: number; current: number; n: number } | null {
  if (seasons.length < 4) return null;
  const sorted = [...seasons].sort((a, b) => a.season - b.season);
  const halves = [sorted.filter((_, i) => i % 2 === 0), sorted.filter((_, i) => i % 2 === 1)];
  let bestC = 0, curC = 0, n = 0;
  for (const [train, test] of [[halves[0], halves[1]], [halves[1], halves[0]]]) {
    const top = gridSearch(buildSamples(train))[0];
    const testSamples = buildSamples(test);
    const b = evaluate(testSamples, top.weights);
    const c = evaluate(testSamples, CURRENT_WEIGHTS);
    bestC += b.correct;
    curC += c.correct;
    n += b.total;
  }
  return { best: bestC / n, current: curC / n, n };
}
