// Gathers every past season (from ESPN, or hand-entered for a season played
// on Fantrax) and runs it through the Records engine.

import { getSeasonHistory, getManagers } from "./content";
import { getHistorySeasons } from "./seasons";
import { getSeasonBundle } from "./season-data";
import { buildRecords, RecSeason } from "./records";

export async function loadRecords(currentSeason: number) {
  const [available, curated, managers] = await Promise.all([
    getHistorySeasons(currentSeason),
    getSeasonHistory(),
    getManagers(),
  ]);
  // Only finished seasons: the one in progress is left out.
  const seasons = available.filter((s) => s !== currentSeason);
  const bundles = await Promise.all(seasons.map((s) => getSeasonBundle(s)));

  const recSeasons: RecSeason[] = [];
  const skipped: number[] = [];
  bundles.forEach((b, i) => {
    const season = seasons[i];
    if (!b || b.matchups.length === 0) {
      skipped.push(season);
      return;
    }
    const entry = curated.find((c) => c.season === season);
    recSeasons.push({
      season,
      teams: b.teams.map((t) => ({ id: t.id, name: t.name, managerId: t.managerId })),
      matchups: b.matchups,
      champion: entry?.champion ?? null,
      runnerUp: entry?.runnerUp ?? null,
    });
  });

  return {
    records: buildRecords(managers, recSeasons),
    seasonsUsed: recSeasons.map((s) => s.season).sort((a, b) => a - b),
    seasonsSkipped: skipped.sort((a, b) => a - b),
    managerCount: managers.length,
  };
}
