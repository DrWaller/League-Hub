import { NextRequest } from "next/server";
import { getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getPeriodVor } from "@/lib/vor";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { OG } from "@/lib/og-theme";
import { renderPortraitThreeStars, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";
import { statLine } from "@/lib/espn-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 3 Stars of the Month: the three most valuable players over replacement across a stretch of weeks
// (a Monthly Period), where a player's value is the sum of his weekly VOR.
export async function GET(req: NextRequest) {
  try {
    const startWeek = Number(req.nextUrl.searchParams.get("startWeek"));
    const endWeek = Number(req.nextUrl.searchParams.get("endWeek"));
    const label = (req.nextUrl.searchParams.get("label") ?? "").trim();
    if (!startWeek || !endWeek || endWeek < startWeek) return new Response("startWeek and endWeek are required (endWeek can't be before startWeek)", { status: 400 });

    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }

    const [period, teams] = await Promise.all([
      getPeriodVor(startWeek, endWeek, seasonParam, meta.season),
      isPast ? getPastSeasonTeams(seasonParam) : getStandings().then((s) => s.teams),
    ]);
    if (!period || !teams) {
      return new Response(
        isPast ? `Couldn't load season ${seasonParam} from ESPN.` : "ESPN isn't connected, or no player stats are posted for these weeks yet.",
        { status: 400 }
      );
    }

    const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? "";
    const top3 = period.players.slice(0, 3);
    const weeksText = startWeek === endWeek ? `week ${startWeek}` : `weeks ${startWeek}-${endWeek}`;
    const subtitle = `${label ? `${label} - ` : ""}${weeksText}`;
    const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = top3.map((p, i) => {
        const sl = statLine(p.position, p.stats);
        const avg = p.gamesPlayed ? `, ${(p.points / p.gamesPlayed).toFixed(2)} avg` : "";
        return `${i + 1}) ${p.name} (${p.position}, ${teamName(p.teamId)}) - ${signed(p.vor)} VOR (${p.points.toFixed(2)} pts${avg})${sl ? `\n    ${sl}` : ""}`;
      });
      return captionResponse(
        [`3 STARS OF THE MONTH`, `${label ? `${label} ` : ""}(${weeksText}${isPast ? `, ${seasonParam}` : ""})`, "", ...lines, "", "Ranked by total value over replacement across the month (points minus the last starter at each position, week by week)."].join("\n")
      );
    }

    const [logos, headshots] = await Promise.all([loadLogoData(isPast), checkHeadshots(top3.map((p) => p.id))]);
    return await renderPortraitThreeStars({
      footer: seasonFooter(meta.name, seasonParam),
      title: isPast ? `3 Stars of the Month - ${seasonParam}` : "3 Stars of the Month",
      subtitle,
      players: top3.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        teamName: teamName(p.teamId),
        points: p.points,
        statLine: statLine(p.position, p.stats),
        vor: p.vor,
        avg: p.gamesPlayed ? p.points / p.gamesPlayed : undefined,
      })),
      labels: ["1ST STAR", "2ND STAR", "3RD STAR"],
      colors: [OG.gold, OG.silver, OG.bronze],
      emptyMessage: "No stats posted for these weeks yet.",
      logos,
      headshots,
    });
  } catch (err) {
    console.error("3 Stars of the Month graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
