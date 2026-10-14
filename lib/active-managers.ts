// The managers still in the league: anyone with a team this season, or (before this season's teams are
// entered) anyone who had a team in the latest finished season.

import type { RecSeason } from "./records";

export function activeManagerIds(everySeason: { season: number; managerId: number | null }[], currentSeason: number, recSeasons: RecSeason[]): Set<number> {
  let active = new Set(everySeason.filter((x) => x.season === currentSeason && x.managerId != null).map((x) => x.managerId as number));
  if (active.size < 2 && recSeasons.length) {
    const latestFinished = [...recSeasons].sort((a, b) => b.season - a.season)[0];
    active = new Set(latestFinished.teams.map((t) => t.managerId).filter((id): id is number => id != null));
  }
  return active;
}
