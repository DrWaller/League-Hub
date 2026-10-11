import { NextRequest } from "next/server";
import { getMatchups, getStandings, getLeagueMeta } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getSeasonBundle } from "@/lib/season-data";
import { seasonFooter } from "@/lib/portrait-graphics";
import { loadLogoData } from "@/lib/og-team-logo";
import { getWeekCalendar } from "@/lib/week-calendar";
import { Matchup } from "@/lib/types";
import { captionResponse } from "@/lib/captions";
import { CloseMode, DEFAULT_MARGIN, TIER_LABELS, pickCloseMatchups, closeMatchupsCaption, daysLeftInWeek } from "@/lib/close-matchups";
import { renderCloseMatchupCard } from "@/lib/close-matchups-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Close Matchups: one 1v1 card per close game (portrait only), like the Big Night cards.
//   ?week=N       defaults to the current week
//   ?mode=live    games still in play that are close right now (going into Saturday / Sunday)
//   ?mode=final   finished games decided by a small margin
//                 (default: "final" once every game in the week is final, otherwise "live")
//   ?margin=N     how close counts as close, in points (default 3, both modes)
//   ?season=YYYY  a past season (final mode)
//   ?list=1       JSON list of the close games, each with the address of its card
//   ?home=ID      the card for the game whose home team has this id (default: the closest game)
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

    const emptyMessage =
      mode === "live"
        ? `No games are within ${margin.toFixed(2)} points right now in week ${week} (or nobody has scored yet). Try a bigger margin, e.g. &margin=${Math.round(margin * 2)}.`
        : `No finished games in week ${week}${isPast ? ` of ${seasonParam}` : ""} were decided by ${margin.toFixed(2)} points or less. Try a bigger margin, e.g. &margin=${Math.round(margin * 2)}.`;

    // The list the Graphics page uses to show one card per close game.
    if (sp.get("list")) {
      return Response.json({
        mode,
        week,
        margin,
        message: games.length === 0 ? emptyMessage : null,
        games: games.map((g) => {
          const q = new URLSearchParams({ week: String(week), mode, home: String(g.homeTeamId) });
          if (isPast) q.set("season", String(seasonParam));
          if (marginRaw) q.set("margin", marginRaw);
          return {
            homeTeamId: g.homeTeamId,
            homeName: teamName(g.homeTeamId),
            awayName: teamName(g.awayTeamId),
            margin: g.margin,
            tierLabel: TIER_LABELS[mode][g.tier],
            card: `/api/admin/graphics/close-matchups?${q.toString()}`,
          };
        }),
      });
    }

    if (games.length === 0) return new Response(emptyMessage, { status: 400 });

    const homeId = Number(sp.get("home")) || null;
    const game = homeId ? games.find((g) => g.homeTeamId === homeId) : games[0];
    if (!game) return new Response(`That matchup isn't within ${margin.toFixed(2)} points in week ${week} any more.`, { status: 400 });

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

    if (sp.get("caption")) return captionResponse(closeMatchupsCaption(week, mode, [game], teamName, daysLeft));

    return await renderCloseMatchupCard({
      game,
      week,
      mode,
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
