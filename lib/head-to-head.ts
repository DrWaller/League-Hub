// All-time head-to-head between managers, built from regular-season results
// (the same games the Records page counts). Series follow the MANAGER, not the
// team name, so a renamed team keeps its history.

import { Matchup } from "./types";
import { regularSeasonFinals } from "./luck";
import { getHistorySeasons } from "./seasons";
import { getSeasonBundle } from "./season-data";
import { getManagers, getManagerSeasons } from "./content";

export interface SeriesGame {
  a: number | null; // manager ids; null = team not linked to a manager
  b: number | null;
  aScore: number;
  bScore: number;
}

export interface Series {
  aWins: number;
  bWins: number;
  ties: number;
}

const key = (x: number, y: number) => (x < y ? `${x}|${y}` : `${y}|${x}`);

export function tallySeries(games: SeriesGame[]): Map<string, { lo: number; loWins: number; hiWins: number; ties: number }> {
  const map = new Map<string, { lo: number; loWins: number; hiWins: number; ties: number }>();
  for (const g of games) {
    if (g.a == null || g.b == null || g.a === g.b) continue;
    const k = key(g.a, g.b);
    const lo = Math.min(g.a, g.b);
    const e = map.get(k) ?? { lo, loWins: 0, hiWins: 0, ties: 0 };
    const loScore = g.a === lo ? g.aScore : g.bScore;
    const hiScore = g.a === lo ? g.bScore : g.aScore;
    if (loScore > hiScore) e.loWins++;
    else if (hiScore > loScore) e.hiWins++;
    else e.ties++;
    map.set(k, e);
  }
  return map;
}

export function seriesBetween(map: ReturnType<typeof tallySeries>, a: number, b: number): Series | null {
  const e = map.get(key(a, b));
  if (!e) return null;
  const aWins = a === e.lo ? e.loWins : e.hiWins;
  const bWins = a === e.lo ? e.hiWins : e.loWins;
  return { aWins, bWins, ties: e.ties };
}

// "EVAN LEADS 5-3", "BOBBY LEADS 7-4-1" or "SERIES TIED 4-4" -- null if they've never played.
export function seriesText(s: Series | null, aName: string, bName: string): string | null {
  if (!s || s.aWins + s.bWins + s.ties === 0) return null;
  const tail = s.ties ? `-${s.ties}` : "";
  if (s.aWins === s.bWins) return `SERIES TIED ${s.aWins}-${s.bWins}${tail}`;
  const lead = s.aWins > s.bWins;
  const [w, l] = lead ? [s.aWins, s.bWins] : [s.bWins, s.aWins];
  return `${(lead ? aName : bName).toUpperCase()} LEADS ${w}-${l}${tail}`;
}

// Loads every past season plus this season's games before `beforeWeek`, and
// returns a lookup from two CURRENT-season team ids to their series text.
export async function loadSeriesLookup(currentSeason: number, currentMatchups: Matchup[], beforeWeek: number) {
  const [available, managers, assignments] = await Promise.all([getHistorySeasons(currentSeason), getManagers(), getManagerSeasons()]);
  const past = available.filter((s) => s !== currentSeason);
  const bundles = await Promise.all(past.map((s) => getSeasonBundle(s)));

  const games: SeriesGame[] = [];
  bundles.forEach((b) => {
    if (!b) return;
    const mgr = new Map(b.teams.map((t) => [t.id, t.managerId as number | null]));
    for (const m of regularSeasonFinals(b.matchups)) {
      games.push({ a: mgr.get(m.homeTeamId) ?? null, b: mgr.get(m.awayTeamId) ?? null, aScore: m.homeScore, bScore: m.awayScore });
    }
  });

  // This season's teams: use the season's own assignment, else the team id's latest earlier manager.
  const managerForCurrent = (teamId: number): number | null => {
    const exact = assignments.find((a) => a.season === currentSeason && a.teamId === teamId && a.managerId != null);
    if (exact) return exact.managerId;
    const earlier = assignments
      .filter((a) => a.teamId === teamId && a.managerId != null && a.season < currentSeason)
      .sort((x, y) => y.season - x.season)[0];
    return earlier?.managerId ?? null;
  };
  for (const m of regularSeasonFinals(currentMatchups).filter((x) => x.week < beforeWeek)) {
    games.push({ a: managerForCurrent(m.homeTeamId), b: managerForCurrent(m.awayTeamId), aScore: m.homeScore, bScore: m.awayScore });
  }

  const tally = tallySeries(games);
  const nameOf = new Map(managers.map((m) => [m.id, m.name]));

  return (teamA: number, teamB: number): string | null => {
    const a = managerForCurrent(teamA);
    const b = managerForCurrent(teamB);
    if (a == null || b == null) return null;
    return seriesText(seriesBetween(tally, a, b), nameOf.get(a) ?? "", nameOf.get(b) ?? "");
  };
}
