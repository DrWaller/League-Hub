import { NextRequest } from "next/server";
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
} from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { buildRadar, categoriesFor, groupOfPositionId, GROUP_NAME, minGamesFor, pointsComparison, POSITION_LABEL, seasonCount, splitRare, type Group, type PoolPlayer } from "@/lib/radar";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { renderPortraitRadar } from "@/lib/radar-image";
import { seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Percentile radar for one player, current season, per-game rates against every
// NHL player at the same position group. ?playerId=N picks the player; without it
// the week's top fantasy scorer (?week=N) is used, like the Player Spotlight.
// &minGames=N overrides the games-played cutoff. &debug=1 returns the numbers as JSON.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const meta = await getLeagueMeta();
    // ?season=YYYY gives a previous season's final numbers (the player must be picked).
    const seasonParam = Number(params.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;
    const season = isPast ? seasonParam : undefined; // undefined = the current season in the ESPN helpers
    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so ESPN has no player data for it.`, { status: 400 });
    }

    // 1. Which player?
    let playerId = Number(params.get("playerId")) || 0;
    if (!playerId) {
      if (isPast) return new Response("Pick a player for a previous season.", { status: 400 });
      const week = Number(params.get("week"));
      if (!week) return new Response("Pick a player, or give a week to use that week's top scorer.", { status: 400 });
      const { players, live } = await getWeeklyPlayerStats(week);
      if (!live || players.length === 0) return new Response("No player stats posted for that week yet.", { status: 400 });
      playerId = [...players].sort((a, b) => b.points - a.points)[0].id;
    }

    // 2. His season line, and the pool of NHL players at his position to rank him against.
    const { player, attempts } = await getPlayerByIdDiag(playerId, season);
    let me: PoolPlayer | null = player;
    let pool: PoolPlayer[] | null = null;
    if (!me) {
      // Last resort: find him inside the position lists themselves.
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
      return new Response(
        `Couldn't load player ${playerId}'s season stats from ESPN. What each attempt returned:\n` +
          attempts.map((a) => `- ${a.filter}: HTTP ${a.status ?? "no response"}, ${a.entries} returned, ${a.usable} usable${a.note ? ` (${a.note})` : ""}`).join("\n"),
        { status: 400 }
      );
    }
    const group = groupOfPositionId(me.positionId);
    if (!pool || pool.length === 0) pool = await getPlayerPool(group, season);
    if (pool.length === 0) {
      const probe = await fetchPoolRaw({ players: { filterSlotIds: { value: group === "F" ? [0, 1, 2] : group === "D" ? [4] : [5] }, limit: 5 } }, season);
      return new Response(
        `Couldn't load the NHL player list from ESPN. Test request: HTTP ${probe.status ?? "no response"}${probe.snippet ? ` - ${probe.snippet}` : ""}${probe.data ? ` - ${(probe.data.players ?? []).length} players returned` : ""}`,
        { status: 400 }
      );
    }

    // 3. The league's scoring categories for his position group.
    const items = await getScoringItems(season);
    const allCats = categoriesFor(group, items);
    const { axes: cats, counts: countCats } = splitRare(allCats);
    if (cats.length < 3) {
      return new Response(
        `Found only ${cats.length} scoring categories for ${GROUP_NAME[group]} (a radar needs at least 3). Scoring items from ESPN: ${JSON.stringify(items)}`,
        { status: 400 }
      );
    }

    // 4. Percentiles.
    const minGP = minGamesFor(pool, Number(params.get("minGames")) || undefined, isPast ? 20 : 15);
    const { axes, eligible } = buildRadar(me, pool, cats, minGP);

    // Fantasy points (total and per game) vs every NHL player and vs his own group.
    const others = (["F", "D", "G"] as Group[]).filter((g) => g !== group);
    const otherPools = await Promise.all(others.map((g) => getPlayerPool(g, season)));
    const overrideGP = Number(params.get("minGames")) || undefined;
    const points = pointsComparison(me, group, [
      { group, pool, minGP },
      ...others.map((g, i) => ({ group: g, pool: otherPools[i], minGP: minGamesFor(otherPools[i], overrideGP, isPast ? 20 : 15) })),
    ]);
    if (eligible === 0) return new Response(`Nobody has played ${minGP} games yet, so there is nothing to rank against. Try &minGames=1.`, { status: 400 });

    if (params.get("debug")) {
      return Response.json({
        player: { id: me.id, name: me.name, positionId: me.positionId, gp: me.gp, appliedTotal: me.appliedTotal },
        group,
        poolSize: pool.length,
        minGP,
        eligible,
        season: seasonParam,
        categories: cats,
        rareAsCounts: countCats.map((c) => ({ label: c.label, total: seasonCount(me!, c) })),
        scoringItems: items,
        axes,
        points,
        rawStats: me.stats,
      });
    }

    const headshots = await checkHeadshots([me.id]);
    let teamName: string | undefined;
    if (!isPast) {
      const [{ rosters }, { teams }] = await Promise.all([getRosters(), getStandings()]);
      const teamId = rosters.find((r) => r.players.some((p) => p.id === me!.id))?.teamId;
      teamName = teams.find((t) => t.id === teamId)?.name ?? "Free agent";
    } else {
      // A previous season: show the fantasy team he was on that year, if ESPN still lists it.
      try {
        const [{ rosters }, pastTeams] = await Promise.all([getRosters(seasonParam), getPastSeasonTeams(seasonParam)]);
        const teamId = rosters.find((r) => r.players.some((p) => p.id === me!.id))?.teamId;
        teamName = pastTeams?.find((t) => t.id === teamId)?.name;
      } catch {
        teamName = undefined;
      }
    }
    const position = POSITION_LABEL[me.positionId] ?? "?";
    const groupName = GROUP_NAME[group];

    if (params.get("caption")) {
      const lines = axes.map((a) => `${a.label} ${Math.round(a.pct)}`).join(" | ");
      const counts = countCats.map((c) => `${c.label} ${seasonCount(me!, c)}`).join(" | ");
      return captionResponse(
        [
          isPast ? `PLAYER RADAR - ${seasonParam}` : "PLAYER RADAR",
          `${me.name} (${position}${teamName ? `, ${teamName}` : ""})`,
          "",
          `Percentile vs NHL ${groupName}, per game (min ${minGP} GP):`,
          lines,
          ...(counts ? ["", `Season totals: ${counts}`] : []),
          "",
          `${me.gp} GP | ${points.total.value.toFixed(1)} fantasy pts (${Math.round(points.total.all.pct)}th pct of all players, ${Math.round(points.total.position.pct)}th of ${groupName}) | ${points.avg.value.toFixed(2)} per game (${Math.round(points.avg.all.pct)}th of all, ${Math.round(points.avg.position.pct)}th of ${groupName})`,
          "",
          "#FantasyHockey",
        ].join("\n")
      );
    }

    const small = me.gp < minGP;
    return await renderPortraitRadar({
      footer: seasonFooter(meta.name, seasonParam),
      subtitle: isPast ? `${seasonParam} season \u00b7 final` : "Season to date",
      playerId: me.id,
      name: me.name,
      position,
      teamName,
      hasHeadshot: headshots.has(me.id),
      axes,
      counts: countCats.map((c) => ({ label: c.label, value: String(seasonCount(me!, c)) })),
      chips: [{ label: "GP", value: String(me.gp) }],
      points,
      positionLabel: groupName.toUpperCase(),
      pointsDisplay: ((): "pct" | "rank" | "both" | "rankpct" => {
        const v = params.get("pts");
        return v === "pct" || v === "rank" || v === "both" ? v : "rankpct";
      })(),
      note: `Ranked vs ${eligible} NHL ${groupName} \u00b7 per game \u00b7 ${minGP}+ GP \u00b7 dashed ring = average`,
      smallSample: small ? `SMALL SAMPLE \u00b7 ${me.gp} GP` : undefined,
    });
  } catch (err) {
    console.error("Player radar failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
