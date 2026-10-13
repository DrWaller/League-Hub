// One manager's career in this league, built from the same regular-season games the Records page counts.
// Pure logic (no I/O). Follows the MANAGER, not the team name, so renamed teams keep their history.

import { regularSeasonFinals } from "./luck";
import { buildRecords, type RecManager, type RecSeason, type CareerRow, type SeasonRow } from "./records";

export interface HistGame {
  season: number;
  week: number;
  teamName: string;
  score: number;
  oppManagerId: number | null;
  oppManagerName: string | null;
  oppTeamName: string;
  oppScore: number;
  result: "W" | "L" | "T";
}

export interface Streak {
  length: number;
  from: { season: number; week: number };
  to: { season: number; week: number };
}

export interface VsRow {
  managerId: number;
  name: string;
  w: number;
  l: number;
  t: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface ManagerHistory {
  career: CareerRow | null;
  seasons: SeasonRow[]; // oldest first
  games: number;
  highScore: HistGame | null;
  lowScore: HistGame | null;
  biggestWin: HistGame | null;
  worstLoss: HistGame | null;
  closestWin: HistGame | null;
  luckyWin: HistGame | null; // fewest points in a win
  unluckyLoss: HistGame | null; // most points in a loss
  winStreak: Streak | null;
  loseStreak: Streak | null;
  currentStreak: { kind: "W" | "L" | "T"; length: number } | null;
  avgScore: number;
  vs: VsRow[]; // best win% first
  bestSeason: SeasonRow | null;
  worstSeason: SeasonRow | null;
  playoffless: number; // finishes outside the top half (a fun "dark days" count)
}

const pct = (w: number, l: number, t: number) => (w + l + t > 0 ? (w + t * 0.5) / (w + l + t) : 0);

export function buildManagerHistory(managerId: number, managers: RecManager[], seasons: RecSeason[]): ManagerHistory {
  const nameOf = new Map(managers.map((m) => [m.id, m.name]));
  const rec = buildRecords(managers, seasons);
  const career = rec.careers.find((c) => c.managerId === managerId) ?? null;
  const mySeasons = rec.seasonRows.filter((r) => r.managerId === managerId).sort((a, b) => a.season - b.season);

  const games: HistGame[] = [];
  const ordered = [...seasons].sort((a, b) => a.season - b.season);
  for (const s of ordered) {
    const teamById = new Map(s.teams.map((t) => [t.id, t]));
    const finals = [...regularSeasonFinals(s.matchups)].sort((a, b) => a.week - b.week);
    for (const m of finals) {
      const home = teamById.get(m.homeTeamId);
      const away = teamById.get(m.awayTeamId);
      for (const [mine, theirs, my, their] of [
        [home, away, m.homeScore, m.awayScore],
        [away, home, m.awayScore, m.homeScore],
      ] as const) {
        if (mine?.managerId !== managerId) continue;
        const oppId = theirs?.managerId ?? null;
        games.push({
          season: s.season,
          week: m.week,
          teamName: mine.name,
          score: my,
          oppManagerId: oppId,
          oppManagerName: oppId ? nameOf.get(oppId) ?? null : null,
          oppTeamName: theirs?.name ?? "Unknown team",
          oppScore: their,
          result: my > their ? "W" : my < their ? "L" : "T",
        });
      }
    }
  }

  const best = (arr: HistGame[], cmp: (a: HistGame, b: HistGame) => number) => (arr.length ? [...arr].sort(cmp)[0] : null);
  const wins = games.filter((g) => g.result === "W");
  const losses = games.filter((g) => g.result === "L");

  // Streaks run across seasons in order; a tie ends a streak.
  const streak = (kind: "W" | "L"): Streak | null => {
    let bestS: Streak | null = null;
    let run = 0;
    let start = 0;
    games.forEach((g, i) => {
      if (g.result === kind) {
        if (run === 0) start = i;
        run++;
        if (!bestS || run > bestS.length) bestS = { length: run, from: { season: games[start].season, week: games[start].week }, to: { season: g.season, week: g.week } };
      } else run = 0;
    });
    return bestS;
  };
  let currentStreak: ManagerHistory["currentStreak"] = null;
  if (games.length) {
    const last = games[games.length - 1].result;
    let n = 0;
    for (let i = games.length - 1; i >= 0 && games[i].result === last; i--) n++;
    currentStreak = { kind: last, length: n };
  }

  const vsMap = new Map<number, VsRow>();
  for (const g of games) {
    if (g.oppManagerId == null) continue;
    const r = vsMap.get(g.oppManagerId) ?? { managerId: g.oppManagerId, name: g.oppManagerName ?? `Manager ${g.oppManagerId}`, w: 0, l: 0, t: 0, pct: 0, pointsFor: 0, pointsAgainst: 0 };
    if (g.result === "W") r.w++;
    else if (g.result === "L") r.l++;
    else r.t++;
    r.pointsFor += g.score;
    r.pointsAgainst += g.oppScore;
    vsMap.set(g.oppManagerId, r);
  }
  const vs = [...vsMap.values()].map((r) => ({ ...r, pct: pct(r.w, r.l, r.t) })).sort((a, b) => b.pct - a.pct || b.w - a.w);

  return {
    career,
    seasons: mySeasons,
    games: games.length,
    highScore: best(games, (a, b) => b.score - a.score),
    lowScore: best(games, (a, b) => a.score - b.score),
    biggestWin: best(wins, (a, b) => b.score - b.oppScore - (a.score - a.oppScore)),
    worstLoss: best(losses, (a, b) => b.oppScore - b.score - (a.oppScore - a.score)),
    closestWin: best(wins, (a, b) => a.score - a.oppScore - (b.score - b.oppScore)),
    luckyWin: best(wins, (a, b) => a.score - b.score),
    unluckyLoss: best(losses, (a, b) => b.score - a.score),
    winStreak: streak("W"),
    loseStreak: streak("L"),
    currentStreak,
    avgScore: games.length ? games.reduce((n, g) => n + g.score, 0) / games.length : 0,
    vs,
    bestSeason: mySeasons.length ? [...mySeasons].sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor)[0] : null,
    worstSeason: mySeasons.length ? [...mySeasons].sort((a, b) => a.winPct - b.winPct || a.pointsFor - b.pointsFor)[0] : null,
    playoffless: mySeasons.filter((s) => s.rank > s.teamCount / 2).length,
  };
}
