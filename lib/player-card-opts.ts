// Everything the two newer player cards (scorecard and hockey card) need, built once from the player profile so
// both cards read the same numbers as the radar and bars.

import type { NextRequest } from "next/server";
import { loadProfile, loadExtras, tierFor, type Profile } from "./player-profile";
import { seasonFooter } from "./portrait-graphics";
import { NHL_ABBREV } from "./best-available";
import { seasonCount, type PointsComparison, type RadarAxis } from "./radar";
import { formatValue } from "./radar-image";
import type { TierName } from "./tiers";
import { getTeamBannerColors } from "./content";
import { loadLogoData } from "./og-team-logo";

export interface CardTotal {
  label: string;
  value: string; // season total (or the rate, for SV% / GAA)
  pct?: number; // percentile, when the category has one
}

// The player's fantasy team, for the card background: its logo and the colours set on the Logos admin page.
export interface FantasyTeam {
  name: string;
  logo?: string; // embedded image data
  primary?: string;
  trim?: string;
}

export interface CardOpts {
  fantasy?: FantasyTeam;
  footer: string;
  seasonLabel: string; // "2025-26"
  playerId: number;
  name: string;
  position: string;
  groupName: string; // "forwards"
  teamName?: string; // the fantasy team
  nhlAbbrev?: string;
  hasHeadshot: boolean;
  photoUrl?: string;
  gp: number;
  axes: RadarAxis[];
  counts: { label: string; value: string }[];
  totals: CardTotal[];
  points: PointsComparison;
  tier: TierName | null;
  eligible: number;
  minGP: number;
  qualified: boolean;
  isPast: boolean;
}

export function buildCardOpts(p: Profile, extras: { teamName?: string; teamId?: number; hasHeadshot: boolean; photoUrl?: string }): CardOpts {
  const nhlAbbrev = p.imported ? p.imported.team.split(",").pop()?.trim() : NHL_ABBREV[p.me.proTeamId];
  const totals: CardTotal[] = [
    ...p.axes.map((a) => {
      const cat = p.cats.find((c) => c.statId === a.statId);
      return { label: a.label, value: a.rate || !cat ? formatValue(a).replace("/gm", "") : String(Math.round(seasonCount(p.me, cat))), pct: a.pct };
    }),
    ...p.counts.map((c) => ({ label: c.label, value: c.value })),
  ];
  return {
    footer: seasonFooter(p.meta.name, p.seasonParam),
    seasonLabel: `${p.seasonParam - 1}-${String(p.seasonParam).slice(2)}`,
    playerId: p.me.id,
    name: p.me.name,
    position: p.position,
    groupName: p.groupName,
    teamName: extras.teamName,
    nhlAbbrev,
    hasHeadshot: extras.hasHeadshot,
    photoUrl: extras.photoUrl,
    gp: p.me.gp,
    axes: p.axes,
    counts: p.counts,
    totals,
    points: p.points,
    tier: tierFor(p),
    eligible: p.eligible,
    minGP: p.minGP,
    qualified: p.qualified,
    isPast: p.isPast,
  };
}

// Shared by both card routes: the same query parameters as the radar and bars.
export async function loadCardOpts(req: NextRequest): Promise<{ response: Response } | { opts: CardOpts; profile: Profile }> {
  const params = req.nextUrl.searchParams;
  const loaded = await loadProfile(params);
  if ("response" in loaded) return loaded;
  const profile = loaded.profile;
  const extras = await loadExtras(profile, Number(params.get("playerId")) || undefined);
  const opts = buildCardOpts(profile, extras);
  // Logos and colours belong to this season's teams, so only a current rostered player gets them.
  if (!profile.isPast && extras.teamId && extras.teamName) {
    const [logos, colors] = await Promise.all([loadLogoData(), getTeamBannerColors()]);
    const c = colors[extras.teamId];
    opts.fantasy = { name: extras.teamName, logo: logos[extras.teamId], primary: c?.primary, trim: c?.trim };
  }
  return { opts, profile };
}
