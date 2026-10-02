import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { computeLuck, regularSeasonFinals } from "@/lib/luck";
import { renderLuckChart } from "@/lib/luck-image";
import { isPortrait, renderPortraitLuck, seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getSeasonBundle } from "@/lib/season-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?week=N charts through week N. ?season=YYYY charts a past season (week
// defaults to that season's last completed regular-season week, i.e. its
// end-of-season chart). With neither, it's the current season's latest week.
// A season played on Fantrax uses the scores entered by hand -- never ESPN.
export async function GET(req: NextRequest) {
  try {
    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    let matchups, teamName: (id: number) => string;

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
      matchups = bundle.matchups;
      teamName = (id) => bundle.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    } else {
      const [m, standings] = await Promise.all([getMatchups(), getStandings()]);
      if (!m.live) return new Response("ESPN isn't connected, so there are no real results to chart.", { status: 400 });
      matchups = m.matchups;
      teamName = (id) => standings.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    }

    const latest = regularSeasonFinals(matchups).reduce((max, m) => Math.max(max, m.week), 0);
    if (!latest) return new Response(`No completed regular-season matchups for ${seasonParam} yet.`, { status: 400 });

    const week = Math.min(Number(req.nextUrl.searchParams.get("week")) || latest, latest);
    const { rows, leagueMedian } = computeLuck(matchups, week);
    if (rows.length === 0) return new Response(`No final matchups through week ${week} yet.`, { status: 400 });

    const title = isPast && week === latest ? `Luck chart - ${seasonParam} final` : undefined;
    const opts = { rows, leagueMedian, week, teamName, title, logos: await loadLogoData(isPast), footer: seasonFooter(meta.name, seasonParam) };
    return isPortrait(req.nextUrl.searchParams.get("format")) ? await renderPortraitLuck(opts) : await renderLuckChart(opts);
  } catch (err) {
    console.error("Luck chart route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
