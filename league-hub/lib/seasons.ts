// One shared answer to "which seasons can the site show?" -- so every page
// (Standings, Matchups, Rosters, Luck Chart, League History) offers the same
// season buttons instead of each deciding for itself.
//
// A season is offered if ESPN has it, or a record was imported for it, or the
// commissioner wrote a League History entry for it -- EXCEPT that a season
// tagged "Played on Fantrax" is kept out of every ESPN-backed list (see
// lib/played-elsewhere.ts). It still appears on League History itself.

import { getPastSeasons } from "./espn";
import { getManagerSeasons, getSeasonHistory } from "./content";
import { buildSeasonLists, seasonsPlayedElsewhere } from "./played-elsewhere";

async function lists(currentSeason: number) {
  const [probed, imported, curated] = await Promise.all([
    getPastSeasons(currentSeason),
    getManagerSeasons(),
    getSeasonHistory(),
  ]);
  return buildSeasonLists({
    current: currentSeason,
    probed,
    imported: imported.map((s) => s.season),
    curated: curated.map((h) => h.season),
    elsewhere: seasonsPlayedElsewhere(curated),
  });
}

// Seasons whose ESPN data may be shown (season buttons on Standings, etc.)
export async function getAvailableSeasons(currentSeason: number): Promise<number[]> {
  return (await lists(currentSeason)).espnSeasons;
}

// Every season League History lists, including ones played on another platform.
export async function getHistorySeasons(currentSeason: number): Promise<number[]> {
  return (await lists(currentSeason)).historySeasons;
}
