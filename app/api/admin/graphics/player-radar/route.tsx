import { NextRequest } from "next/server";
import {
  getLeagueMeta,
  getPlayerPool,
  getPlayersById,
  getRosters,
  getScoringItems,
  getStandings,
  getWeeklyPlayerStats,
} from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { buildRadar, categoriesFor, groupOfPositionId, GROUP_NAME, minGamesFor, POSITION_LABEL } from "@/lib/radar";
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
    if (params.get("season") && Number(params.get("season")) !== meta.season) {
      return new Response("Player Radar uses current-season data only.", { status: 400 });
    }

    // 1. Which player?
    let playerId = Number(params.get("playerId")) || 0;
    if (!playerId) {
      const week = Number(params.get("week"));
      if (!week) return new Response("Pick a player, or give a week to use that week's top scorer.", { status: 400 });
      const { players, live } = await getWeeklyPlayerStats(week);
      if (!live || players.length === 0) return new Response("No player stats posted for that week yet.", { status: 400 });
      playerId = [...players].sort((a, b) => b.points - a.points)[0].id;
    }

    // 2. His season line, and the pool of NHL players at his position to rank him against.
    const found = await getPlayersById([playerId]);
    const me = found[0];
    if (!me) return new Response("Couldn't find that player's season stats on ESPN.", { status: 400 });
    const group = groupOfPositionId(me.positionId);
    const pool = await getPlayerPool(group);
    if (pool.length === 0) return new Response("Couldn't load the NHL player list from ESPN (is it connected?).", { status: 400 });

    // 3. The league's scoring categories for his position group.
    const items = await getScoringItems();
    const cats = categoriesFor(group, items);
    if (cats.length < 3) {
      return new Response(
        `Found only ${cats.length} scoring categories for ${GROUP_NAME[group]} (a radar needs at least 3). Scoring items from ESPN: ${JSON.stringify(items)}`,
        { status: 400 }
      );
    }

    // 4. Percentiles.
    const minGP = minGamesFor(pool, Number(params.get("minGames")) || undefined);
    const { axes, eligible } = buildRadar(me, pool, cats, minGP);
    if (eligible === 0) return new Response(`Nobody has played ${minGP} games yet, so there is nothing to rank against. Try &minGames=1.`, { status: 400 });

    if (params.get("debug")) {
      return Response.json({
        player: { id: me.id, name: me.name, positionId: me.positionId, gp: me.gp, appliedTotal: me.appliedTotal },
        group,
        poolSize: pool.length,
        minGP,
        eligible,
        categories: cats,
        scoringItems: items,
        axes,
        rawStats: me.stats,
      });
    }

    const [{ rosters }, { teams }, headshots] = await Promise.all([getRosters(), getStandings(), checkHeadshots([me.id])]);
    const teamId = rosters.find((r) => r.players.some((p) => p.id === me.id))?.teamId;
    const teamName = teams.find((t) => t.id === teamId)?.name ?? "Free agent";
    const position = POSITION_LABEL[me.positionId] ?? "?";
    const groupName = GROUP_NAME[group];

    if (params.get("caption")) {
      const lines = axes.map((a) => `${a.label} ${Math.round(a.pct)}`).join(" | ");
      return captionResponse(
        [`PLAYER RADAR`, `${me.name} (${position}, ${teamName})`, "", `Percentile vs NHL ${groupName}, per game (min ${minGP} GP):`, lines, "", `${me.gp} GP, ${me.appliedTotal.toFixed(1)} fantasy pts`, "", "#FantasyHockey"].join("\n")
      );
    }

    const small = me.gp < minGP;
    return await renderPortraitRadar({
      footer: seasonFooter(meta.name, meta.season),
      subtitle: "Season to date",
      playerId: me.id,
      name: me.name,
      position,
      teamName,
      hasHeadshot: headshots.has(me.id),
      axes,
      chips: [
        { label: "GP", value: String(me.gp) },
        { label: "FANTASY PTS", value: me.appliedTotal.toFixed(1) },
        { label: "PTS/GP", value: me.gp > 0 ? (me.appliedTotal / me.gp).toFixed(1) : "-" },
      ],
      note: `Ranked vs ${eligible} NHL ${groupName} \u00b7 per game \u00b7 ${minGP}+ GP \u00b7 dashed ring = average`,
      smallSample: small ? `SMALL SAMPLE \u00b7 ${me.gp} GP` : undefined,
    });
  } catch (err) {
    console.error("Player radar failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
