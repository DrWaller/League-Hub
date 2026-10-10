import { NextRequest } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { currentSeason } from "@/lib/espn-daily";
import { getNight } from "@/lib/nightly-store";
import { prettyDate } from "@/lib/nightly-blurbs";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { seasonFooter } from "@/lib/portrait-graphics";
import { renderBigNights } from "@/lib/big-night-graphic";
import { captionResponse, playersCaption } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Big Nights graphic: the saved big games for one night (Game of the Night
// featured, the rest listed). Portrait only.
//   /api/admin/graphics/big-nights                   -> the latest saved night
//   /api/admin/graphics/big-nights?date=2026-10-05   -> a specific night
//   add &caption=1 for the ready-to-post text
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const date = params.get("date") || undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("date must look like 2026-10-05", { status: 400 });
    }
    if ((params.get("format") ?? "").toLowerCase() === "landscape") {
      return new Response("Big Nights is portrait only.", { status: 400 });
    }

    const season = currentSeason();
    const night = await getNight(season, date);
    if (!night) {
      return new Response(
        date ? `No big nights saved for ${date}.` : "No big nights saved yet. Save a night first (/api/admin/nightly-blurbs?save=1).",
        { status: 400 }
      );
    }

    if (params.get("caption")) {
      return captionResponse(
        playersCaption(
          "Big Nights",
          prettyDate(night.date),
          night.blurbs.map((b) => ({ name: b.playerName, team: b.teamName, points: b.points, line: b.statLine })),
          false
        )
      );
    }

    const meta = await getLeagueMeta();
    const [logos, headshots] = await Promise.all([loadLogoData(false), checkHeadshots(night.blurbs.map((b) => b.playerId))]);
    return await renderBigNights({ night, footer: seasonFooter(meta.name, season), logos, headshots });
  } catch (err) {
    console.error("Big Nights graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
