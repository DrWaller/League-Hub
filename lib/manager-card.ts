// Everything the manager trading card needs, built from the same career data as the manager page.
// Server-side only (loads records, logos and team colours).

import { getManagers, getManagerSeasons, getTeamBannerColors } from "./content";
import { getLeagueMeta } from "./espn";
import { loadRecords } from "./records-data";
import { buildManagerHistory } from "./manager-history";
import { buildRecords } from "./records";
import { loadLogoData } from "./og-team-logo";

export interface ManagerCardData {
  name: string;
  team: string | null;
  logo?: string;
  primary?: string;
  trim?: string;
  firstSeason: number | null;
  lastSeason: number | null;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  titles: number;
  runnerUps: number;
  firstPlace: number;
  avgScore: number;
  scoreRank: number; // rank of points per game among all managers, 1 = best
  managerCount: number;
  best: { season: number; record: string } | null;
  nemesis: { name: string; record: string } | null;
  victim: { name: string; record: string } | null;
  tags: string[]; // the first one is the card's seal
  leagueName: string;
}

const MIN_VS_GAMES = 3;

export async function loadManagerCard(managerId: number): Promise<ManagerCardData | null> {
  const meta = await getLeagueMeta();
  const [managers, mySeasons, rec] = await Promise.all([getManagers(), getManagerSeasons(managerId), loadRecords(meta.season)]);
  const manager = managers.find((m) => m.id === managerId);
  if (!manager) return null;
  const h = buildManagerHistory(managerId, rec.managers, rec.recSeasons);
  const c = h.career;
  const all = buildRecords(rec.managers, rec.recSeasons).careers;

  const perGame = (x: { pointsFor: number; wins: number; losses: number; ties: number }) => {
    const g = x.wins + x.losses + x.ties;
    return g ? x.pointsFor / g : 0;
  };
  const myPpg = c ? perGame(c) : 0;
  const scoreRank = 1 + all.filter((x) => perGame(x) > myPpg).length;
  const winRank = c ? 1 + all.filter((x) => x.winPct > c.winPct).length : all.length;

  const rows = h.vs.filter((r) => r.w + r.l + r.t >= MIN_VS_GAMES);
  const rec2 = (r: { w: number; l: number; t: number }) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ""}`;
  const victim = rows.length ? rows[0] : null;
  const nemesis = rows.length ? [...rows].sort((a, b) => a.pct - b.pct || b.l - a.l)[0] : null;

  // Style tags: a few plain-language labels earned from the numbers; the first is the seal.
  const tags: string[] = [];
  if (c && c.titles >= 2) tags.push("Dynasty");
  else if (c && c.titles === 1) tags.push("Champion");
  const seasonsPlayed = h.seasons.length;
  const topHalf = h.seasons.filter((s) => s.rank <= s.teamCount / 2).length;
  if (seasonsPlayed >= 3 && topHalf / seasonsPlayed >= 0.75) tags.push("Contender");
  if (seasonsPlayed >= 3) {
    const mean = h.seasons.reduce((n, s) => n + s.winPct, 0) / seasonsPlayed;
    const sd = Math.sqrt(h.seasons.reduce((n, s) => n + (s.winPct - mean) ** 2, 0) / seasonsPlayed);
    if (sd >= 0.17) tags.push("Boom or bust");
  }
  if (scoreRank <= 2 && all.length >= 4) tags.push("Points machine");
  if (c && scoreRank <= Math.ceil(all.length / 3) && winRank >= Math.ceil((all.length * 2) / 3)) tags.push("Unlucky");
  if (c && scoreRank >= Math.ceil((all.length * 2) / 3) && winRank <= Math.ceil(all.length / 3)) tags.push("Lucky");
  if (!tags.length) tags.push(seasonsPlayed >= 3 ? "Steady" : "Rookie");

  const latest = [...mySeasons].sort((a, b) => b.season - a.season)[0];
  const [logos, colors] = await Promise.all([loadLogoData(), getTeamBannerColors()]);
  const teamId = latest?.teamId;
  const col = teamId != null ? colors[teamId] : undefined;

  return {
    name: manager.name,
    team: latest?.teamName ?? null,
    logo: teamId != null ? logos[teamId] : undefined,
    primary: col?.primary,
    trim: col?.trim,
    firstSeason: mySeasons.length ? Math.min(...mySeasons.map((s) => s.season)) : null,
    lastSeason: latest?.season ?? null,
    seasons: c?.seasons ?? 0,
    wins: c?.wins ?? 0,
    losses: c?.losses ?? 0,
    ties: c?.ties ?? 0,
    winPct: c?.winPct ?? 0,
    titles: c?.titles ?? 0,
    runnerUps: c?.runnerUps ?? 0,
    firstPlace: c?.firstPlace ?? 0,
    avgScore: h.avgScore,
    scoreRank,
    managerCount: all.length,
    best: h.bestSeason ? { season: h.bestSeason.season, record: rec2({ w: h.bestSeason.wins, l: h.bestSeason.losses, t: h.bestSeason.ties }) } : null,
    nemesis: nemesis ? { name: nemesis.name, record: rec2(nemesis) } : null,
    victim: victim ? { name: victim.name, record: rec2(victim) } : null,
    tags: tags.slice(0, 4),
    leagueName: meta.name,
  };
}
