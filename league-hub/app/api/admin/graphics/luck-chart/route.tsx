import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta, getHistoricalSeasonTeams } from "@/lib/espn";
import { computeLuck, regularSeasonFinals } from "@/lib/luck";
import { renderLuckChart } from "@/lib/luck-image";
import { getPlayedElsewhereSeasons } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?week=N charts through week N. ?season=YYYY charts a past season (week
// defaults to that season's last completed regular-season week, i.e. its
// end-of-season chart). With neither, it's the current season's latest week.
export async function GET(req: NextRequest) {
  try {
    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN data to chart.`, { status: 400 });
    }

    let matchups, live: boolean, teamName: (id: number) => string;

    if (isPast) {
      const [m, hist] = await Promise.all([getMatchups(undefined, seasonParam), getHistoricalSeasonTeams(seasonParam)]);
      matchups = m.matchups;
      live = m.live && hist.ok;
      teamName = (id) => hist.teams?.find((t) => t.id === id)?.name ?? `Team ${id}`;
    } else {
      const [m, standings] = await Promise.all([getMatchups(), getStandings()]);
      matchups = m.matchups;
      live = m.live;
      teamName = (id) => standings.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    }

    if (!live) {
      return new Response(
        isPast ? `Couldn't load season ${seasonParam} from ESPN.` : "ESPN isn't connected, so there are no real results to chart.",
        { status: 400 }
      );
    }

    const latest = regularSeasonFinals(matchups).reduce((max, m) => Math.max(max, m.week), 0);
    if (!latest) return new Response(`No completed regular-season matchups for ${seasonParam} yet.`, { status: 400 });

    const week = Math.min(Number(req.nextUrl.searchParams.get("week")) || latest, latest);
    const { rows, leagueMedian } = computeLuck(matchups, week);
    if (rows.length === 0) return new Response(`No final matchups through week ${week} yet.`, { status: 400 });

    const title = isPast && week === latest ? `Luck chart - ${seasonParam} final` : undefined;
    return await renderLuckChart({ rows, leagueMedian, week, teamName, title });
  } catch (err) {
    console.error("Luck chart route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
