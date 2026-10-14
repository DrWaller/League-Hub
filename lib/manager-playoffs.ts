// Pure logic. Playoff history for every manager: which seasons they made the playoffs, how long the current run
// of appearances is, the longest run and the longest drought. The league's rule: the top 6 teams on regular-season
// record make the playoffs every season, whatever ESPN's own setting says.

import { buildRecords, type RecManager, type RecSeason, type SeasonRow } from "./records";

export const PLAYOFF_SPOTS = 6;

export interface PlayoffSeason {
  season: number;
  teamName: string;
  rank: number;
  teamCount: number;
  spots: number;
  made: boolean;
  result: "Champion" | "Runner-up" | "Made it" | "Missed";
  edge: "last spot" | "missed by one" | null; // squeaked in on the final spot, or just missed
}

export interface PlayoffSummary {
  managerId: number;
  name: string;
  seasons: number;
  made: number;
  pct: number;
  titles: number;
  runnerUps: number;
  currentStreak: number; // consecutive appearances up to the latest season (0 if missed it)
  longestStreak: number;
  currentDrought: number; // consecutive misses up to the latest season
  longestDrought: number;
  lastSpot: number; // times in on the final spot
  missedByOne: number;
  rows: PlayoffSeason[]; // oldest first
}

export interface PlayoffReport {
  me: PlayoffSummary | null;
  all: PlayoffSummary[];
  appearancesRank: number; // 1 = most appearances (ties share)
  rateRank: number; // 1 = best rate, among managers with 3+ seasons
  spotsBySeason: Record<number, number>;
}

export function buildPlayoffReport(managerId: number, managers: RecManager[], seasons: RecSeason[]): PlayoffReport {
  const rec = buildRecords(managers, seasons);
  const spotsBySeason: Record<number, number> = {};
  for (const s of seasons) spotsBySeason[s.season] = PLAYOFF_SPOTS;

  const byManager = new Map<number, SeasonRow[]>();
  for (const r of rec.seasonRows) byManager.set(r.managerId, [...(byManager.get(r.managerId) ?? []), r]);

  const nameOf = new Map(managers.map((m) => [m.id, m.name]));
  const all: PlayoffSummary[] = [...byManager.entries()].map(([id, rows]) => {
    const sorted = [...rows].sort((a, b) => a.season - b.season);
    const list: PlayoffSeason[] = sorted.map((r) => {
      const spots = PLAYOFF_SPOTS;
      const made = r.rank <= spots || r.champion || r.runnerUp;
      const result: PlayoffSeason["result"] = r.champion ? "Champion" : r.runnerUp ? "Runner-up" : made ? "Made it" : "Missed";
      return {
        season: r.season,
        teamName: r.teamName,
        rank: r.rank,
        teamCount: r.teamCount,
        spots,
        made,
        result,
        edge: r.rank === spots ? "last spot" : r.rank === spots + 1 && !made ? "missed by one" : null,
      };
    });
    let longest = 0;
    let run = 0;
    let longestDry = 0;
    let dry = 0;
    for (const s of list) {
      run = s.made ? run + 1 : 0;
      dry = s.made ? 0 : dry + 1;
      longest = Math.max(longest, run);
      longestDry = Math.max(longestDry, dry);
    }
    const made = list.filter((s) => s.made).length;
    return {
      managerId: id,
      name: nameOf.get(id) ?? `Manager ${id}`,
      seasons: list.length,
      made,
      pct: list.length ? made / list.length : 0,
      titles: list.filter((s) => s.result === "Champion").length,
      runnerUps: list.filter((s) => s.result === "Runner-up").length,
      currentStreak: run,
      longestStreak: longest,
      currentDrought: dry,
      longestDrought: longestDry,
      lastSpot: list.filter((s) => s.edge === "last spot").length,
      missedByOne: list.filter((s) => s.edge === "missed by one").length,
      rows: list,
    };
  });

  const me = all.find((x) => x.managerId === managerId) ?? null;
  const rated = all.filter((x) => x.seasons >= 3);
  return {
    me,
    all,
    appearancesRank: me ? 1 + all.filter((x) => x.made > me.made).length : 0,
    rateRank: me && me.seasons >= 3 ? 1 + rated.filter((x) => x.pct > me.pct).length : 0,
    spotsBySeason,
  };
}
