import { NextRequest } from "next/server";
import { loadProfile, loadExtras, debugJson, profileCaption } from "@/lib/player-profile";
import { renderPortraitRadar } from "@/lib/radar-image";
import { seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Percentile radar for one player: per-game rates in the league's scoring categories, ranked
// against every NHL player at the same position group. ?playerId=N picks the player; without it
// the week's top fantasy scorer (?week=N) is used. &season=YYYY a previous season (needs a player).
// &minGames=N overrides the games-played cutoff. &debug=1 returns the numbers as JSON.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const loaded = await loadProfile(params);
    if ("response" in loaded) return loaded.response;
    const p = loaded.profile;

    if (params.get("debug")) return Response.json(debugJson(p));

    const { teamName, hasHeadshot, photoUrl } = await loadExtras(p, Number(params.get("playerId")) || undefined);
    if (params.get("caption")) return captionResponse(profileCaption(p, "PLAYER RADAR", teamName));

    return await renderPortraitRadar({
      footer: seasonFooter(p.meta.name, p.seasonParam),
      subtitle: p.isPast ? `${p.seasonParam} season \u00b7 final \u00b7 your league's categories` : "Season to date \u00b7 your league's categories",
      playerId: p.me.id,
      name: p.me.name,
      position: p.position,
      teamName,
      hasHeadshot,
      photoUrl,
      axes: p.axes,
      counts: p.counts,
      gp: p.me.gp,
      points: p.points,
      positionLabel: p.groupName.toUpperCase(),
      pointsDisplay: ((): "pct" | "rank" | "both" | "rankpct" => {
        const v = params.get("pts");
        return v === "pct" || v === "rank" || v === "both" ? v : "rankpct";
      })(),
      note: `Ranked vs ${p.eligible} NHL ${p.groupName} \u00b7 per game \u00b7 ${p.minGP}+ GP \u00b7 dashed ring = median`,
      qualified: p.qualified,
      smallSample: p.qualified ? undefined : `NOT QUALIFIED \u00b7 ${p.me.gp} of ${p.minGP} GP`,
    });
  } catch (err) {
    console.error("Player radar failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
