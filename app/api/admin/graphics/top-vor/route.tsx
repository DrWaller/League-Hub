import { NextRequest } from "next/server";
import { getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { getWeekVor } from "@/lib/vor";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse, weekLine, weekDatesText } from "@/lib/captions";
import { renderTopVorCard, VOR_ROWS } from "@/lib/vor-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }

    const [vor, teams] = await Promise.all([
      getWeekVor(week, seasonParam, meta.season),
      isPast ? getPastSeasonTeams(seasonParam) : getStandings().then((s) => s.teams),
    ]);
    if (!vor || !teams) {
      return new Response(
        isPast ? `Couldn't load season ${seasonParam} from ESPN.` : "ESPN isn't connected, or no player stats are posted for this week yet.",
        { status: 400 }
      );
    }

    const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? "";
    const top = vor.players.slice(0, VOR_ROWS);

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(seasonParam, meta.season, week, await weekDatesText(seasonParam, meta.season, week));
      const lines = top.map(
        (p, i) => `${i + 1}) ${p.name} (${p.position}, ${teamName(p.teamId)}) - ${p.vor >= 0 ? "+" : ""}${p.vor.toFixed(2)} VOR (${p.points.toFixed(2)} pts)`
      );
      return captionResponse(
        ["TOP PLAYERS BY VALUE OVER REPLACEMENT", when, "", ...lines, "", "VOR = fantasy points minus the last starter at that position, so every position is on one scale."].join("\n")
      );
    }

    const [logos, headshots] = await Promise.all([loadLogoData(isPast), checkHeadshots(top.map((p) => p.id))]);
    return await renderTopVorCard({
      vor,
      players: top,
      teamName,
      logos,
      headshots,
      footer: seasonFooter(meta.name, seasonParam),
      title: isPast ? `Top Players (VOR) - ${seasonParam}` : "Top Players (VOR)",
    });
  } catch (err) {
    console.error("Top VOR graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
