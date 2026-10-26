// Gathers every past season (from ESPN, or hand-entered for a season played
// on Fantrax) and runs it through the Records engine.

import { getSeasonHistory, getManagers, getManagerSeasons, getSeasonRules } from "./content";
import { getHistorySeasons } from "./seasons";
import { getSeasonBundle } from "./season-data";
import { getMatchups, getStandings } from "./espn";
import { applyRules } from "./season-rules";
import { buildRecords, RecSeason } from "./records";

// The season in progress, for the single-game lists only (highest scores, blowouts, ...): its finished
// regular-season weeks count the moment ESPN marks them final. Null when ESPN isn't connected.
async function loadCurrentSeasonGames(currentSeason: number): Promise<RecSeason | null> {
  try {
    const [{ teams, live }, { matchups }, managerSeasons, rules] = await Promise.all([
      getStandings(),
      getMatchups(),
      getManagerSeasons(),
      getSeasonRules(currentSeason),
    ]);
    if (!live || matchups.length === 0) return null;
    return {
      season: currentSeason,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        // This season's manager rows may not be entered yet: fall back to whoever held the same ESPN team slot most recently.
        managerId:
          managerSeasons.find((m) => m.season === currentSeason && m.teamId === t.id)?.managerId ??
          managerSeasons.filter((m) => m.season < currentSeason && m.teamId === t.id && m.managerId != null).sort((a, b) => b.season - a.season)[0]?.managerId ??
          null,
      })),
      matchups: applyRules(matchups, rules),
      champion: null,
      runnerUp: null,
    };
  } catch {
    return null;
  }
}

export async function loadRecords(currentSeason: number) {
  const [available, curated, managers, currentGames] = await Promise.all([
    getHistorySeasons(currentSeason),
    getSeasonHistory(),
    getManagers(),
    loadCurrentSeasonGames(currentSeason),
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
    records: buildRecords(managers, recSeasons, currentGames ? [currentGames] : []),
    recSeasons,
    // The season in progress; counts toward the single-game lists only.
    currentGames,
    seasonsUsed: recSeasons.map((s) => s.season).sort((a, b) => a - b),
    seasonsSkipped: skipped.sort((a, b) => a - b),
    managers,
    managerCount: managers.length,
  };
}
