// Works out every team banner the league has earned: one "Regular Season
// Champions" banner per season (best regular-season record, then points for --
// the same rule League History uses) and one "Champions" banner per season
// the commissioner has recorded a champion for. Server-side only.

import { getLeagueMeta } from "./espn";
import { findTeamByText } from "./team-match";
import { getSeasonBundle } from "./season-data";
import {
  getSeasonHistory,
  getManagers,
  getManagerSeasons,
  getTeamLogos,
  getTeamBannerColors,
  getTeamSeasonLooks,
} from "./content";
import { getHistorySeasons } from "./seasons";
import { seasonsPlayedElsewhere } from "./played-elsewhere";
import { BannerColors, BannerKind, DEFAULT_BANNER_COLORS, TeamBanner, teamKey } from "./banner-types";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

interface Row {
  teamId: number;
  name: string;
  managerId: number | null;
  wins: number;
  losses: number;
  pointsFor: number;
}

const byRecord = (a: Row, b: Row) => b.wins - b.losses - (a.wins - a.losses) || b.pointsFor - a.pointsFor;

export async function getTeamBanners(): Promise<TeamBanner[]> {
  const meta = await getLeagueMeta();
  const [available, curated, managers, managerSeasons, logos, colors, seasonLooks] = await Promise.all([
    getHistorySeasons(meta.season),
    getSeasonHistory(),
    getManagers(),
    getManagerSeasons(),
    getTeamLogos(),
    getTeamBannerColors(),
    getTeamSeasonLooks(),
  ]);

  // Same season list League History shows: finished seasons, plus the current
  // one only if the commissioner has already written an entry for it.
  const elsewhere = seasonsPlayedElsewhere(curated);
  const seasons = available.filter((s) => s !== meta.season || curated.some((c) => c.season === s));

  const managerName = (id: number | null) => (id ? managers.find((m) => m.id === id)?.name ?? null : null);

  // A team's own logo/colours first; otherwise any team the same manager has
  // had (team ids differ in seasons played on another platform).
  function lookup<T>(map: Record<number, T>, teamId: number | null, managerId: number | null): T | null {
    if (teamId !== null && map[teamId]) return map[teamId];
    if (managerId !== null) {
      const mine = managerSeasons.filter((m) => m.managerId === managerId).sort((a, b) => b.season - a.season);
      for (const m of mine) if (map[m.teamId]) return map[m.teamId];
    }
    return null;
  }

  function make(kind: BannerKind, season: number, teamName: string, teamId: number | null, managerId: number | null): TeamBanner {
    // This season's own look (logo / colours) wins; anything not set for the
    // season falls back to the team's general look.
    const key = teamKey(teamName);
    const look = seasonLooks.find((l) => l.season === season && l.teamKey === key);
    const general: BannerColors = lookup(colors, teamId, managerId) ?? DEFAULT_BANNER_COLORS;
    const c: BannerColors = look?.primary && look.trim ? { primary: look.primary, trim: look.trim, text: look.text } : general;
    return {
      key: `${season}-${kind}`,
      season,
      kind,
      teamName,
      managerId,
      managerName: managerName(managerId),
      teamKey: key,
      hasSeasonLook: Boolean(look),
      logoUrl: look?.logoUrl ?? lookup(logos, teamId, managerId),
      primary: c.primary,
      trim: c.trim,
      text: c.text ?? null,
    };
  }

  const perSeason = await Promise.all(
    seasons.map(async (season): Promise<TeamBanner[]> => {
      const bundle = await getSeasonBundle(season);
      let rows: Row[] = [];
      if (bundle) {
        rows = bundle.teams.map((t) => ({
          teamId: t.id,
          name: t.name,
          managerId: t.managerId,
          wins: t.wins,
          losses: t.losses,
          pointsFor: t.pointsFor,
        }));
      } else if (!elsewhere.has(season)) {
        rows = managerSeasons
          .filter((m) => m.season === season && m.wins !== null)
          .map((m) => ({
            teamId: m.teamId,
            name: m.teamName,
            managerId: m.managerId,
            wins: m.wins ?? 0,
            losses: m.losses ?? 0,
            pointsFor: m.pointsFor ?? 0,
          }));
      }
      rows.sort(byRecord);

      const out: TeamBanner[] = [];
      if (rows.length > 0) {
        out.push(make("regular", season, rows[0].name, rows[0].teamId, rows[0].managerId));
      }

      // Playoff results are typed in as text, so match them back to a team.
      const entry = curated.find((c) => c.season === season);
      const playoffBanner = (kind: BannerKind, typed: string | null | undefined) => {
        if (!typed) return;
        const row = findTeamByText(rows, typed, (r) => r.name, (r) => managerName(r.managerId));
        const ms = findTeamByText(
          managerSeasons.filter((m) => m.season === season),
          typed,
          (m) => m.teamName,
          (m) => managerName(m.managerId)
        );
        out.push(make(kind, season, row?.name ?? typed, row?.teamId ?? ms?.teamId ?? null, row?.managerId ?? ms?.managerId ?? null));
      };
      playoffBanner("champion", entry?.champion);
      playoffBanner("runnerUp", entry?.runnerUp);
      return out;
    })
  );

  // Oldest first, like banners hung in the rafters; within a season the
  // regular-season banner comes before the championship, then the runner-up.
  const order: Record<BannerKind, number> = { regular: 0, champion: 1, runnerUp: 2 };
  return perSeason.flat().sort((a, b) => a.season - b.season || order[a.kind] - order[b.kind]);
}
