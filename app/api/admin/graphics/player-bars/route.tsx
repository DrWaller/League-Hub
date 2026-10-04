import { NextRequest } from "next/server";
import { loadProfile, loadExtras, debugJson, profileCaption } from "@/lib/player-profile";
import { renderPortraitBars } from "@/lib/bars-image";
import { seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Percentile bars for one player (same data and parameters as the Player Radar):
// ?playerId=N or ?week=N (the week's top scorer), &season=YYYY, &minGames=N, &debug=1.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const loaded = await loadProfile(params);
    if ("response" in loaded) return loaded.response;
    const p = loaded.profile;

    if (params.get("debug")) return Response.json(debugJson(p));

    const { teamName, hasHeadshot, photoUrl } = await loadExtras(p, Number(params.get("playerId")) || undefined);
    if (params.get("caption")) return captionResponse(profileCaption(p, "PLAYER BARS", teamName));

    return await renderPortraitBars({
      footer: seasonFooter(p.meta.name, p.seasonParam),
      subtitle: p.isPast ? `${p.seasonParam} season \u00b7 final \u00b7 your league's categories` : "Season to date \u00b7 your league's categories",
      playerId: p.me.id,
      name: p.me.name,
      position: p.position,
      teamName,
      hasHeadshot,
      photoUrl,
      group: p.group,
      axes: p.axes,
      counts: p.counts,
      gp: p.me.gp,
      points: p.points,
      positionLabel: p.groupName.toUpperCase(),
      note: `Ranked vs ${p.eligible} NHL ${p.groupName} \u00b7 per game \u00b7 ${p.minGP}+ GP`,
      qualified: p.qualified,
      smallSample: p.qualified ? undefined : `NOT QUALIFIED \u00b7 ${p.me.gp} of ${p.minGP} GP`,
    });
  } catch (err) {
    console.error("Player bars failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
