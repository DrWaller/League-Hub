import { NextRequest } from "next/server";
import { getLeagueMeta, getScoringItems } from "@/lib/espn";
import { currentSeason } from "@/lib/espn-daily";
import { getNight } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { seasonFooter } from "@/lib/portrait-graphics";
import { renderBigNightCard } from "@/lib/big-night-card";
import { captionResponse, playersCaption } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// One graphic per big-night player, from the blurbs saved for that night.
//   /api/admin/graphics/big-night?playerId=4697384            -> that player's card (latest saved night)
//   /api/admin/graphics/big-night?date=2026-10-05&playerId=…  -> a specific night
//   add &caption=1 for the ready-to-post text
//   /api/admin/graphics/big-night?list=1                      -> JSON list of the night's players
// Without a playerId it makes the night's top scorer. Portrait only.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const date = params.get("date") || undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("date must look like 2026-10-05", { status: 400 });
    }
    if ((params.get("format") ?? "").toLowerCase() === "landscape") {
      return new Response("Big Night cards are portrait only.", { status: 400 });
    }

    const season = currentSeason();
    const night = await getNight(season, date);
    if (!night) {
      return new Response(
        date ? `No big nights saved for ${date}.` : "No big nights saved yet. Save a night first (/api/admin/nightly-blurbs?save=1).",
        { status: 400 }
      );
    }

    if (params.get("list")) {
      return Response.json({
        date: night.date,
        players: night.blurbs.map((b) => ({
          playerId: b.playerId,
          name: b.playerName,
          team: b.teamName,
          points: b.points,
          card: `/api/admin/graphics/big-night?date=${night.date}&playerId=${b.playerId}`,
        })),
      });
    }

    const playerId = Number(params.get("playerId")) || null;
    const blurb = playerId
      ? night.blurbs.find((b) => b.playerId === playerId)
      : [...night.blurbs].sort((a, b) => b.points - a.points)[0];
    if (!blurb) return new Response("That player has no saved big night for this date.", { status: 400 });

    if (params.get("caption")) {
      return captionResponse(
        playersCaption("Big Night", prettyDate(night.date), [{ name: blurb.playerName, team: blurb.teamName, points: blurb.points, line: blurb.statLine }], false)
      );
    }

    const meta = await getLeagueMeta();
    const [logos, headshots, scoring] = await Promise.all([loadLogoData(false), checkHeadshots([blurb.playerId]), getScoringItems()]);
    // Every stat the league scores points for; the card shows the ones this player recorded.
    const scoredIds = new Set(scoring.filter((i) => i.points !== 0).map((i) => String(i.statId)));
    return await renderBigNightCard({
      date: night.date,
      blurb,
      footer: seasonFooter(meta.name, season),
      logos,
      hasHeadshot: headshots.has(blurb.playerId),
      scoredIds,
    });
  } catch (err) {
    console.error("Big Night card failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
