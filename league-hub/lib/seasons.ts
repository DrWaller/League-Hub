// One shared answer to "which seasons can the site show?" -- so every page
// (Standings, Matchups, Rosters, Luck Chart, League History) offers the same
// season buttons instead of each deciding for itself.
//
// A season counts if ESPN has it, or if a record was imported for it, or if
// the commissioner has written a League History entry for it (which is how a
// season that isn't on ESPN at all -- the Fantrax year -- still gets listed).

import { getPastSeasons } from "./espn";
import { getManagerSeasons, getSeasonHistory } from "./content";

export async function getAvailableSeasons(currentSeason: number): Promise<number[]> {
  const [past, imported, curated] = await Promise.all([
    getPastSeasons(currentSeason),
    getManagerSeasons(),
    getSeasonHistory(),
  ]);
  return Array.from(
    new Set([currentSeason, ...past, ...imported.map((s) => s.season), ...curated.map((h) => h.season)])
  ).sort((a, b) => b - a);
}
