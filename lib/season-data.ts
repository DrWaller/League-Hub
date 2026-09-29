// One provider for "what happened in past season X?", used by Standings,
// Matchups, the Luck Chart, League History and the Records page -- so none of
// them needs to know whether a season came from ESPN or was entered by hand.
//
//  - A season tagged "Played on Fantrax" NEVER touches ESPN. If weekly scores
//    were entered by hand for it, that's the data; otherwise there is none.
//  - Any other past season comes from ESPN (cached a day).

import { getMatchups, getPastSeasonTeams } from "./espn";
import { getManagerSeasons, getManualSeasonData, getPlayedElsewhereSeasons, getSeasonRules } from "./content";
import { applyRules, hasRules } from "./season-rules";
import { computeStandings } from "./manual-season";
import { Matchup } from "./types";

export interface SeasonTeam {
  id: number;
  name: string;
  managerId: number | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface SeasonBundle {
  season: number;
  source: "espn" | "manual";
  teams: SeasonTeam[];
  matchups: Matchup[];
}

// The season exactly as ESPN (or the pasted scores) gave it, before the
// commissioner's rulings on playoffs / games that don't count are applied.
export async function getSeasonBundleRaw(season: number): Promise<SeasonBundle | null> {
  const elsewhere = await getPlayedElsewhereSeasons();

  if (elsewhere.has(season)) {
    const { teams, matchups } = await getManualSeasonData(season);
    if (teams.length === 0) return null;
    const standings = new Map(computeStandings(teams, matchups).map((r) => [r.id, r]));
    return {
      season,
      source: "manual",
      matchups,
      teams: teams.map((t) => {
        const r = standings.get(t.id)!;
        return { id: t.id, name: t.name, managerId: t.managerId, wins: r.wins, losses: r.losses, ties: r.ties, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst };
      }),
    };
  }

  const [espnTeams, { matchups }, managerSeasons] = await Promise.all([
    getPastSeasonTeams(season),
    getMatchups(undefined, season),
    getManagerSeasons(),
  ]);
  if (!espnTeams) return null;
  const managerOf = (teamId: number) =>
    managerSeasons.find((m) => m.season === season && m.teamId === teamId)?.managerId ?? null;
  return {
    season,
    source: "espn",
    matchups,
    teams: espnTeams.map((t) => ({
      id: t.id,
      name: t.name,
      managerId: managerOf(t.id),
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
    })),
  };
}

export const byRecord = (a: SeasonTeam, b: SeasonTeam) =>
  b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor;


// The season with the commissioner's rulings applied. When a season has any
// ruling its standings are recomputed from the games that count, because
// ESPN's own win-loss totals can't know about them.
export async function getSeasonBundle(season: number): Promise<SeasonBundle | null> {
  const raw = await getSeasonBundleRaw(season);
  if (!raw) return null;
  const rules = await getSeasonRules(season);
  if (!hasRules(rules)) return raw;

  const matchups = applyRules(raw.matchups, rules);
  const standings = new Map(computeStandings(raw.teams, matchups).map((r) => [r.id, r]));
  return {
    ...raw,
    matchups,
    teams: raw.teams.map((t) => {
      const r = standings.get(t.id)!;
      return { ...t, wins: r.wins, losses: r.losses, ties: r.ties, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst };
    }),
  };
}
