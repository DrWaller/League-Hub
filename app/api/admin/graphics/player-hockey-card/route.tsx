import { NextRequest } from "next/server";
import { loadCardOpts } from "@/lib/player-card-opts";
import { debugJson, profileCaption } from "@/lib/player-profile";
import { renderHockeyCard } from "@/lib/hockey-card-image";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// HOCKEY CARD: same parameters as the Player Radar (?playerId=N, &season=YYYY, &minGames=N, &debug=1).
export async function GET(req: NextRequest) {
  try {
    const loaded = await loadCardOpts(req);
    if ("response" in loaded) return loaded.response;
    const { opts, profile } = loaded;
    if (req.nextUrl.searchParams.get("debug")) return Response.json(debugJson(profile));
    if (req.nextUrl.searchParams.get("caption")) return captionResponse(profileCaption(profile, "HOCKEY CARD", opts.teamName));
    return await renderHockeyCard(opts);
  } catch (err) {
    console.error("HOCKEY CARD failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
