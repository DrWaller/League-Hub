import { NextRequest } from "next/server";
import { getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getPeriodVor } from "@/lib/vor";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { graphicTiers } from "@/lib/og-tier";
import { renderPortraitSpotlight, seasonFooter } from "@/lib/portrait-graphics";
import { spotlightTiles, statLine } from "@/lib/espn-stats";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSITION_GROUPS: Record<string, string[]> = {
  any: ["C", "LW", "RW", "D", "G"],
  forward: ["C", "LW", "RW"],
  defense: ["D"],
  goalie: ["G"],
};
const POSITION_NAMES: Record<string, string> = { C: "Center", LW: "Left Wing", RW: "Right Wing", D: "Defenseman", G: "Goaltender" };
const PAST_WEEKS = 24; // a past season: every week up to here that has data (weeks with none are skipped)

// Player Spotlight, full season: one featured player over the whole season so far (or a past season). By default the most
// valuable player over replacement (the sum of his weekly VOR), optionally narrowed by ?position= or picked with ?playerId=.
// ?endWeek=N stops at a given week; without it, the current season runs through the CURRENT week (games played so far
// included), so its games, points and stats match the other player graphics, which use the full season to date.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const position = (params.get("position") || "any").toLowerCase();
    const playerId = Number(params.get("playerId")) || null;
    if (!POSITION_GROUPS[position]) return new Response("position must be any, forward, defense or goalie", { status: 400 });

    const meta = await getLeagueMeta();
    const seasonParam = Number(params.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;
    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }
    const endWeek = Number(params.get("endWeek")) || (isPast ? PAST_WEEKS : Math.max(1, meta.currentWeek));

    const [period, teams] = await Promise.all([
      getPeriodVor(1, endWeek, seasonParam, meta.season),
      isPast ? getPastSeasonTeams(seasonParam) : getStandings().then((s) => s.teams),
    ]);
    if (!period || !teams) {
      return new Response(isPast ? `Couldn't load season ${seasonParam} from ESPN.` : "ESPN isn't connected, or no player stats are posted yet.", { status: 400 });
    }

    const pool = period.players.filter((p) => POSITION_GROUPS[position].includes(p.position));
    const player = playerId ? period.players.find((p) => p.id === playerId) : pool[0];
    if (!player) return new Response(playerId ? "That player has no stats posted this season." : "No player stats posted yet.", { status: 400 });

    const avg = player.gamesPlayed ? player.points / player.gamesPlayed : undefined;
    const team = teams.find((t) => t.id === player.teamId)?.name ?? "";
    const subtitle = isPast ? `${seasonParam} season` : `Season to date · ${period.weeks} ${period.weeks === 1 ? "week" : "weeks"}`;

    if (params.get("caption")) {
      const sl = statLine(player.position, player.stats);
      return captionResponse(
        [
          "PLAYER SPOTLIGHT: SEASON",
          subtitle,
          "",
          `${player.name} (${team}) - ${player.vor >= 0 ? "+" : ""}${player.vor.toFixed(2)} VOR (${player.points.toFixed(2)} pts${avg !== undefined ? `, ${avg.toFixed(2)} avg` : ""}, ${player.gamesPlayed} GP)`,
          ...(sl ? [`    ${sl}`] : []),
        ].join("\n")
      );
    }

    const [logos, headshots, tierIdx] = await Promise.all([loadLogoData(isPast), checkHeadshots([player.id]), graphicTiers(isPast)]);
    return await renderPortraitSpotlight({
      footer: seasonFooter(meta.name, seasonParam),
      subtitle,
      positionName: POSITION_NAMES[player.position] ?? player.position,
      player: { id: player.id, name: player.name, teamId: player.teamId, teamName: team, points: player.points, vor: player.vor, avg, tier: tierIdx[player.id] ?? null },
      tiles: spotlightTiles(player.position, player.stats),
      logos,
      hasHeadshot: headshots.has(player.id),
    });
  } catch (err) {
    console.error("Player spotlight (season) failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
