import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getSeasonBundle } from "@/lib/season-data";
import { renderScoreboard } from "@/lib/scoreboard-image";
import { Matchup } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?week=N is required. ?season=YYYY uses a past season (from ESPN, or the
// scores entered by hand for a season played on Fantrax).
export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    let matchups: Matchup[];
    let teamName: (id: number) => string;

    if (isPast) {
      const bundle = await getSeasonBundle(seasonParam);
      if (!bundle) {
        const elsewhere = (await getPlayedElsewhereSeasons()).has(seasonParam);
        return new Response(
          elsewhere
            ? `${seasonParam} was played on Fantrax and no weekly scores have been entered for it yet.`
            : `Couldn't load season ${seasonParam} from ESPN.`,
          { status: 400 }
        );
      }
      matchups = bundle.matchups.filter((m) => m.week === week);
      teamName = (id) => bundle.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    } else {
      const [m, standings] = await Promise.all([getMatchups(week), getStandings()]);
      if (!m.live) return new Response("ESPN isn't connected, so there are no real scores to show.", { status: 400 });
      matchups = m.matchups.filter((x) => x.week === week);
      teamName = (id) => standings.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    }

    if (!matchups.some((m) => m.isFinal)) {
      return new Response(`No games are final yet for week ${week}${isPast ? ` of ${seasonParam}` : ""}.`, { status: 400 });
    }

    return await renderScoreboard({
      matchups,
      week,
      teamName,
      title: isPast ? `Week ${week} scoreboard - ${seasonParam}` : undefined,
    });
  } catch (err) {
    console.error("Scoreboard graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
