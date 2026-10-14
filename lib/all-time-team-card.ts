// Everything the all-time team graphic needs: the manager's team look plus the first and second all-star teams.
// Server-side only.

import { getManagers, getManagerSeasons, getTeamBannerColors } from "./content";
import { getLeagueMeta } from "./espn";
import { loadLogoData } from "./og-team-logo";
import { loadAllTimeTeam } from "./franchise-player";
import { teamLookOverride } from "./team-look";

export interface AllTimePlayer {
  name: string;
  points: number;
  seasons: number;
}

export interface AllTimeTeamCardData {
  managerName: string;
  team: string | null;
  logo?: string;
  primary?: string;
  trim?: string;
  accent?: string;
  // [first team, second team]; each has LW, C, RW, D, D, G (null = open spot).
  teams: { LW: AllTimePlayer | null; C: AllTimePlayer | null; RW: AllTimePlayer | null; D: (AllTimePlayer | null)[]; G: AllTimePlayer | null }[];
  total: number;
  leagueName: string;
}

export async function loadAllTimeTeamCard(managerId: number): Promise<AllTimeTeamCardData | null> {
  const meta = await getLeagueMeta();
  const [managers, mySeasons, spots] = await Promise.all([getManagers(), getManagerSeasons(managerId), loadAllTimeTeam(managerId)]);
  const manager = managers.find((m) => m.id === managerId);
  if (!manager) return null;
  const [logos, colors] = await Promise.all([loadLogoData(), getTeamBannerColors()]);
  const latest = [...mySeasons].sort((a, b) => b.season - a.season)[0];
  const teamId = latest?.teamId;
  const col = teamId != null ? colors[teamId] : undefined;
  const look = teamLookOverride(manager.name, latest?.teamName ?? null);

  const by = (pos: string) =>
    (spots.find((s) => s.pos === pos)?.players ?? []).map((p): AllTimePlayer => ({ name: p.name, points: p.points, seasons: p.seasons.length }));
  const C = by("C"), LW = by("LW"), RW = by("RW"), D = by("D"), G = by("G");
  const teams = [0, 1].map((i) => ({
    LW: LW[i] ?? null,
    C: C[i] ?? null,
    RW: RW[i] ?? null,
    D: [D[i * 2] ?? null, D[i * 2 + 1] ?? null],
    G: G[i] ?? null,
  }));
  const total = [...C, ...LW, ...RW, ...D, ...G].reduce((n, p) => n + p.points, 0);
  return {
    managerName: manager.name,
    team: latest?.teamName ?? null,
    logo: teamId != null ? logos[teamId] : undefined,
    primary: look?.primary ?? col?.primary,
    trim: col?.trim,
    accent: look?.accent,
    teams,
    total,
    leagueName: meta.name,
  };
}
