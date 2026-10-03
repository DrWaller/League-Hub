import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { calculatePowerRankingsWithMovement } from "@/lib/power-rankings";
import { renderPreview, PreviewGame, PreviewSide } from "@/lib/preview-image";
import { isPortrait, renderPortraitPreview, seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { loadSeriesLookup } from "@/lib/head-to-head";
import { Team } from "@/lib/types";
import { captionResponse, playersCaption, lineupCaption, standingsCaption, rankingsCaption, scoreboardCaption, previewCaption, luckCaption, weekLine, weekDatesText } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?week=N -- the games of week N, each team's record and power-ranking spot
// going in (i.e. through week N-1). Current season only.
export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    const season = Number(req.nextUrl.searchParams.get("season"));
    const meta = await getLeagueMeta();
    if (season && season !== meta.season) {
      return new Response("Matchup previews can only be made for the current season.", { status: 400 });
    }

    const [standings, weekData, all] = await Promise.all([getStandings(), getMatchups(week), getMatchups()]);
    if (!standings.live) return new Response("ESPN isn't connected, so there's no schedule to preview.", { status: 400 });

    const games = weekData.matchups.filter((m) => m.week === week && m.homeTeamId != null && m.awayTeamId != null);
    if (games.length === 0) return new Response(`No matchups found for week ${week} yet.`, { status: 400 });

    // Records and ranks "going in": results through the previous week only.
    let teams: Team[] = standings.teams;
    const rankOf = new Map<number, number>();
    if (week > 1) {
      const r = calculatePowerRankingsWithMovement(standings.teams, all.matchups, week - 1);
      if (r.throughWeek > 0) {
        teams = r.teams;
        for (const e of r.rankings) rankOf.set(e.teamId, e.rank);
      }
    }
    if (rankOf.size === 0) {
      // No completed games before this week (week 1): show 0-0 records, no ranks.
      teams = standings.teams.map((t) => ({ ...t, wins: 0, losses: 0, ties: 0 }));
    }

    const side = (id: number): PreviewSide => {
      const t = teams.find((x) => x.id === id);
      return {
        teamId: id,
        name: t?.name ?? `Team ${id}`,
        record: t ? `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}` : "",
        rank: rankOf.get(id),
      };
    };
    // All-time series between the two managers (a failure here shouldn't sink the graphic).
    let seriesFor: (a: number, b: number) => string | null = () => null;
    try {
      seriesFor = await loadSeriesLookup(meta.season, all.matchups, week);
    } catch (err) {
      console.warn("Head-to-head lookup failed", err);
    }
    const previews: PreviewGame[] = games.map((g) => ({
      home: side(g.homeTeamId),
      away: side(g.awayTeamId),
      series: seriesFor(g.homeTeamId, g.awayTeamId) ?? undefined,
    }));

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(meta.season, meta.season, week, await weekDatesText(meta.season, meta.season, week));
      return captionResponse(previewCaption(when, previews.map((p) => ({ a: p.home.name, b: p.away.name, series: p.series }))));
    }

    const logos = await loadLogoData();
    return isPortrait(req.nextUrl.searchParams.get("format"))
      ? await renderPortraitPreview({ games: previews, week, logos, footer: seasonFooter(meta.name, meta.season) })
      : await renderPreview({ games: previews, week, logos });
  } catch (err) {
    console.error("Matchup preview failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
