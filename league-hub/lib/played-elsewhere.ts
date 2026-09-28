// Pure helpers (no database, no ESPN) for the "played on another platform"
// rule, so the rule itself can be tested on its own.

import { ManagerSeason, PLAYED_ELSEWHERE_TAG, SeasonHistoryRecord } from "./types";

export function seasonsPlayedElsewhere(curated: SeasonHistoryRecord[]): Set<number> {
  return new Set(curated.filter((h) => h.tags.includes(PLAYED_ELSEWHERE_TAG)).map((h) => h.season));
}

// Saved manager-season rows for such a season may hold ESPN records or team
// names from an earlier import. A row nobody was assigned to is pure import
// leftovers, so it's dropped; an assigned row (someone deliberately linked a
// manager) stays, but with the ESPN win/loss/points numbers blanked.
export function hideEspnDataForSeasons(rows: ManagerSeason[], elsewhere: Set<number>): ManagerSeason[] {
  if (elsewhere.size === 0) return rows;
  return rows
    .filter((r) => !(elsewhere.has(r.season) && r.managerId === null))
    .map((r) =>
      elsewhere.has(r.season)
        ? { ...r, wins: null, losses: null, ties: null, pointsFor: null, pointsAgainst: null }
        : r
    );
}

// Two season lists with different jobs:
//  - espnSeasons: seasons whose ESPN data may be shown (Standings, Matchups,
//    Rosters, Luck Chart buttons). Excludes played-elsewhere seasons.
//  - historySeasons: every season League History should list, including
//    played-elsewhere ones (which have a hand-written entry but no ESPN data).
export function buildSeasonLists(input: {
  current: number;
  probed: number[];
  imported: number[];
  curated: number[];
  elsewhere: Set<number>;
}) {
  const all = new Set([input.current, ...input.probed, ...input.imported, ...input.curated]);
  const desc = (a: number, b: number) => b - a;
  return {
    espnSeasons: Array.from(all).filter((s) => !input.elsewhere.has(s)).sort(desc),
    historySeasons: Array.from(all).sort(desc),
  };
}
