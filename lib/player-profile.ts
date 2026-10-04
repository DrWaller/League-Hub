// Everything the player cards (radar and bars) need for one player, computed once so the
// cards can't disagree: his season line, the position pool he is ranked against, the league's
// scoring categories for his group, percentiles, and the fantasy points comparison.

import {
  fetchPoolRaw,
  getLeagueMeta,
  getPastSeasonTeams,
  getPlayerPool,
  getPlayerByIdDiag,
  getRosters,
  getScoringItems,
  getStandings,
  getWeeklyPlayerStats,
} from "./espn";
import { checkHeadshots } from "./headshots";
import {
  buildRadar,
  categoriesFor,
  groupOfPositionId,
  GROUP_NAME,
  minGamesFor,
  pointsComparison,
  POSITION_LABEL,
  seasonCount,
  splitRare,
  type Category,
  type Group,
  type PointsComparison,
  type PoolPlayer,
  type RadarAxis,
} from "./radar";
import { getPlayedElsewhereSeasons } from "./content";
import type { LeagueMeta } from "./types";

export interface Profile {
  meta: LeagueMeta;
  seasonParam: number;
  isPast: boolean;
  me: PoolPlayer;
  group: Group;
  groupName: string;
  position: string;
  poolSize: number;
  axes: RadarAxis[];
  cats: Category[];
  countCats: Category[];
  counts: { label: string; value: string }[];
  points: PointsComparison;
  eligible: number;
  minGP: number;
  items: { statId: number; points: number }[];
  qualified: boolean; // has he played at least the minimum games?
}

export async function loadProfile(params: URLSearchParams): Promise<{ response: Response } | { profile: Profile }> {
  const fail = (text: string) => ({ response: new Response(text, { status: 400 }) });
  const meta = await getLeagueMeta();
  const seasonParam = Number(params.get("season")) || meta.season;
  const isPast = seasonParam !== meta.season;
  const season = isPast ? seasonParam : undefined; // undefined = the current season in the ESPN helpers
  if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
    return fail(`${seasonParam} was played on Fantrax, so ESPN has no player data for it.`);
  }

  // 1. Which player?
  let playerId = Number(params.get("playerId")) || 0;
  if (!playerId) {
    if (isPast) return fail("Pick a player for a previous season.");
    const week = Number(params.get("week"));
    if (!week) return fail("Pick a player, or give a week to use that week's top scorer.");
    const { players, live } = await getWeeklyPlayerStats(week);
    if (!live || players.length === 0) return fail("No player stats posted for that week yet.");
    playerId = [...players].sort((a, b) => b.points - a.points)[0].id;
  }

  // 2. His season line, and the pool of NHL players at his position to rank him against.
  const { player, attempts } = await getPlayerByIdDiag(playerId, season);
  let me: PoolPlayer | null = player;
  let pool: PoolPlayer[] | null = null;
  if (!me) {
    for (const g of ["F", "D", "G"] as Group[]) {
      const list = await getPlayerPool(g, season);
      const hit = list.find((x) => x.id === playerId);
      if (hit) {
        me = hit;
        pool = list;
        break;
      }
    }
  }
  if (!me) {
    return fail(
      `Couldn't load player ${playerId}'s season stats from ESPN. What each attempt returned:\n` +
        attempts.map((a) => `- ${a.filter}: HTTP ${a.status ?? "no response"}, ${a.entries} returned, ${a.usable} usable${a.note ? ` (${a.note})` : ""}`).join("\n")
    );
  }
  const group = groupOfPositionId(me.positionId);
  if (!pool || pool.length === 0) pool = await getPlayerPool(group, season);
  if (pool.length === 0) {
    const probe = await fetchPoolRaw({ players: { filterSlotIds: { value: group === "F" ? [0, 1, 2] : group === "D" ? [4] : [5] }, limit: 5 } }, season);
    return fail(
      `Couldn't load the NHL player list from ESPN. Test request: HTTP ${probe.status ?? "no response"}${probe.snippet ? ` - ${probe.snippet}` : ""}${probe.data ? ` - ${(probe.data.players ?? []).length} players returned` : ""}`
    );
  }

  // 3. The league's scoring categories for his position group.
  const items = await getScoringItems(season);
  const allCats = categoriesFor(group, items);
  const { axes: cats, counts: countCats } = splitRare(allCats);
  if (cats.length < 3) {
    return fail(`Found only ${cats.length} scoring categories for ${GROUP_NAME[group]} (a chart needs at least 3). Scoring items from ESPN: ${JSON.stringify(items)}`);
  }

  // 4. Percentiles, and fantasy points vs everyone and vs his own group.
  const overrideGP = Number(params.get("minGames")) || undefined;
  const cap = isPast ? 20 : 15;
  const minGP = minGamesFor(pool, overrideGP, cap);
  const { axes, eligible } = buildRadar(me, pool, cats, minGP);
  const others = (["F", "D", "G"] as Group[]).filter((g) => g !== group);
  const otherPools = await Promise.all(others.map((g) => getPlayerPool(g, season)));
  const points = pointsComparison(me, group, [
    { group, pool, minGP },
    ...others.map((g, i) => ({ group: g, pool: otherPools[i], minGP: minGamesFor(otherPools[i], overrideGP, cap) })),
  ]);
  if (eligible === 0) return fail(`Nobody has played ${minGP} games yet, so there is nothing to rank against. Try &minGames=1.`);

  const myPlayer = me;
  return {
    profile: {
      meta,
      seasonParam,
      isPast,
      me: myPlayer,
      group,
      groupName: GROUP_NAME[group],
      position: POSITION_LABEL[myPlayer.positionId] ?? "?",
      poolSize: pool.length,
      axes,
      cats,
      countCats,
      counts: countCats.map((c) => ({ label: c.label, value: String(seasonCount(myPlayer, c)) })),
      points,
      eligible,
      minGP,
      items,
      qualified: myPlayer.gp >= minGP,
    },
  };
}

// The pieces that need extra ESPN calls (the debug view skips these).
export async function loadExtras(p: Profile): Promise<{ teamName?: string; hasHeadshot: boolean }> {
  const headshots = await checkHeadshots([p.me.id]);
  let teamName: string | undefined;
  if (!p.isPast) {
    const [{ rosters }, { teams }] = await Promise.all([getRosters(), getStandings()]);
    const teamId = rosters.find((r) => r.players.some((x) => x.id === p.me.id))?.teamId;
    teamName = teams.find((t) => t.id === teamId)?.name ?? "Free agent";
  } else {
    try {
      const [{ rosters }, pastTeams] = await Promise.all([getRosters(p.seasonParam), getPastSeasonTeams(p.seasonParam)]);
      const teamId = rosters.find((r) => r.players.some((x) => x.id === p.me.id))?.teamId;
      teamName = pastTeams?.find((t) => t.id === teamId)?.name;
    } catch {
      teamName = undefined;
    }
  }
  return { teamName, hasHeadshot: headshots.has(p.me.id) };
}

export function debugJson(p: Profile) {
  return {
    player: { id: p.me.id, name: p.me.name, positionId: p.me.positionId, gp: p.me.gp, appliedTotal: p.me.appliedTotal },
    group: p.group,
    poolSize: p.poolSize,
    minGP: p.minGP,
    eligible: p.eligible,
    qualified: p.qualified,
    season: p.seasonParam,
    categories: p.cats,
    rareAsCounts: p.counts,
    scoringItems: p.items,
    axes: p.axes,
    points: p.points,
    rawStats: p.me.stats,
  };
}

export function profileCaption(p: Profile, title: string, teamName?: string): string {
  const lines = p.axes.map((a) => `${a.label} ${Math.round(a.pct)}`).join(" | ");
  const counts = p.counts.map((c) => `${c.label} ${c.value}`).join(" | ");
  const pts = p.points;
  return [
    p.isPast ? `${title} - ${p.seasonParam}` : title,
    `${p.me.name} (${p.position}${teamName ? `, ${teamName}` : ""})`,
    "",
    `Percentile vs NHL ${p.groupName}, per game (min ${p.minGP} GP):`,
    lines,
    ...(counts ? ["", `Season totals: ${counts}`] : []),
    "",
    `${p.me.gp} GP${p.qualified ? "" : " (not yet qualified)"} | ${pts.total.value.toFixed(1)} fantasy pts (#${pts.total.all.rank} of all players, #${pts.total.position.rank} of ${p.groupName}) | ${pts.avg.value.toFixed(2)} per game (#${pts.avg.all.rank} of all, #${pts.avg.position.rank} of ${p.groupName})`,
    "",
    "#FantasyHockey",
  ].join("\n");
}
