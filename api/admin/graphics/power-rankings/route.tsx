import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { calculatePowerRankingsWithMovement } from "@/lib/power-rankings";
import { renderPowerRankings } from "@/lib/power-rankings-image";
import { isPortrait, renderPortraitPowerRankings, seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { captionResponse, playersCaption, lineupCaption, standingsCaption, rankingsCaption, scoreboardCaption, previewCaption, luckCaption, weekLine, weekDatesText } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?week=N ranks the teams as of week N (default: the latest final week), with
// movement arrows versus the week before. Current season only -- the rankings
// are built from this season's live standings and results.
export async function GET(req: NextRequest) {
  try {
    const season = Number(req.nextUrl.searchParams.get("season"));
    const meta = await getLeagueMeta();
    if (season && season !== meta.season) {
      return new Response("Power rankings can only be made for the current season.", { status: 400 });
    }

    const [{ teams, live }, m] = await Promise.all([getStandings(), getMatchups()]);
    if (!live) return new Response("ESPN isn't connected, so there are no real results to rank.", { status: 400 });

    const week = Number(req.nextUrl.searchParams.get("week")) || undefined;
    const { rankings, teams: ranked, throughWeek } = calculatePowerRankingsWithMovement(teams, m.matchups, week);
    if (throughWeek === 0) return new Response("No completed regular-season games yet, so there's nothing to rank.", { status: 400 });

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(meta.season, meta.season, throughWeek, await weekDatesText(meta.season, meta.season, throughWeek));
      return captionResponse(
        rankingsCaption(
          when,
          rankings.map((r) => ({ rank: r.rank, name: ranked.find((t) => t.id === r.teamId)?.name ?? `Team ${r.teamId}`, change: r.previousRank != null ? r.previousRank - r.rank : null }))
        )
      );
    }

    const logos = await loadLogoData();
    if (isPortrait(req.nextUrl.searchParams.get("format"))) {
      return await renderPortraitPowerRankings({ rankings, teams: ranked, throughWeek, logos, footer: seasonFooter(meta.name, meta.season) });
    }
    return await renderPowerRankings({ rankings, teams: ranked, throughWeek, logos });
  } catch (err) {
    console.error("Power rankings graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
