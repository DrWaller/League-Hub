import { NextRequest } from "next/server";
import { getDraftAssessment } from "@/lib/draft-assessment";
import { getLeagueMeta } from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { renderDraftRound } from "@/lib/draft-round-image";
import { valueKinds } from "@/lib/draft-value-split";
import { seasonFooter } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) graphic of one team's drafted picks in order, with steals and busts tagged: /api/cards/draft-team?team=Name
export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get("team");
    if (!team) return new Response("team is required", { status: 400 });
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    if (!data) return new Response("No saved draft for this season yet.", { status: 404 });
    const kinds = valueKinds(data.picks);
    const picks = data.picks.filter((p) => !p.keeper && p.team === team).sort((a, b) => a.overall - b.overall);
    if (picks.length === 0) return new Response(`No picks found for ${team}.`, { status: 404 });
    const labels = new Map<number, string>();
    for (const p of picks) {
      const k = kinds.get(p.overall);
      if (k) labels.set(p.overall, k === "steals" ? "STEAL" : k === "busts" ? "BUST" : "MISSED TIME");
    }
    const ids = picks.flatMap((p) => (p.playerId != null && p.playerId > 0 ? [p.playerId] : []));
    const headshots = ids.length ? await checkHeadshots(ids) : new Set<number>();
    return await renderDraftRound({ round: 0, picks, title: `${team} Draft`, hideTeam: true, labels, footer: seasonFooter(meta.name, meta.season), headshots });
  } catch (err) {
    console.error("Draft team graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
