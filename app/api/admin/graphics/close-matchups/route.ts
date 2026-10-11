import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getSeasonBundle } from "@/lib/season-data";
import { seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { getWeekCalendar } from "@/lib/week-calendar";
import { Matchup } from "@/lib/types";
import { captionResponse } from "@/lib/captions";
import { CloseMode, DEFAULT_MARGIN, pickCloseMatchups, closeMatchupsCaption, daysLeftInWeek } from "@/lib/close-matchups";
import { renderPortraitCloseMatchups } from "@/lib/close-matchups-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Close Matchups (portrait only).
//   ?week=N       defaults to the current week
//   ?mode=live    games still in play that are close right now (going into Saturday / Sunday)
//   ?mode=final   finished games decided by a small margin
//                 (default: "final" once every game in the week is final, otherwise "live")
//   ?margin=N     how close counts as close, in points (default 20 live / 10 final)
//   ?season=YYYY  a past season (final mode)
//   ?caption=1    ready-to-post text instead of the image
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const meta = await getLeagueMeta();
    const week = Number(sp.get("week")) || meta.currentWeek;
    const seasonParam = Number(sp.get("season")) || meta.season;
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

    if (matchups.length === 0) return new Response(`No matchups found for week ${week}${isPast ? ` of ${seasonParam}` : ""}.`, { status: 400 });

    const asked = (sp.get("mode") ?? "").toLowerCase();
    const allFinal = matchups.every((m) => m.isFinal);
    const mode: CloseMode = asked === "live" || asked === "final" ? asked : allFinal || isPast ? "final" : "live";

    const marginRaw = sp.get("margin");
    const marginNum = marginRaw ? Number(marginRaw) : NaN;
    const margin = Number.isFinite(marginNum) && marginNum > 0 ? marginNum : DEFAULT_MARGIN[mode];

    const games = pickCloseMatchups(matchups, mode, margin);
    if (games.length === 0) {
      return new Response(
        mode === "live"
          ? `No games are within ${margin.toFixed(2)} points right now in week ${week} (or nobody has scored yet). Try a bigger margin, e.g. &margin=${Math.round(margin * 2)}.`
          : `No finished games in week ${week}${isPast ? ` of ${seasonParam}` : ""} were decided by ${margin.toFixed(2)} points or less. Try a bigger margin, e.g. &margin=${Math.round(margin * 2)}.`,
        { status: 400 }
      );
    }

    // Days still to play (live, current season only). Optional: no calendar saved = no line.
    let daysLeft: number | null = null;
    if (mode === "live" && !isPast) {
      try {
        const cal = await getWeekCalendar(meta.season);
        if (cal) daysLeft = daysLeftInWeek(cal.startDate, cal.lengths, week);
      } catch {
        /* a nice-to-have */
      }
    }

    if (sp.get("caption")) return captionResponse(closeMatchupsCaption(week, mode, games, teamName, daysLeft));

    return await renderPortraitCloseMatchups({
      games,
      week,
      mode,
      margin,
      daysLeft,
      teamName,
      logos: await loadLogoData(isPast),
      footer: seasonFooter(meta.name, seasonParam),
      pastSeason: isPast ? seasonParam : undefined,
    });
  } catch (err) {
    console.error("Close matchups graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
