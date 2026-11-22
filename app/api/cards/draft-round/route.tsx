import { NextRequest } from "next/server";
import { getDraftAssessment } from "@/lib/draft-assessment";
import { getLeagueMeta } from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { renderDraftRound } from "@/lib/draft-round-image";
import { renderPickCards } from "@/lib/draft-card-image";
import { seasonFooter } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) graphic for one draft round: /api/cards/draft-round?round=3 (add &keepers=1 for the keeper rounds).
export async function GET(req: NextRequest) {
  try {
    const round = Number(req.nextUrl.searchParams.get("round"));
    const keepers = req.nextUrl.searchParams.get("keepers") === "1";
    if (!Number.isInteger(round) || round < 1) return new Response("round must be a number", { status: 400 });
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    if (!data) return new Response("No saved draft for this season yet.", { status: 404 });
    const picks = data.picks.filter((p) => (p.round ?? Math.ceil(p.overall / 10)) === round && p.keeper === keepers);
    if (picks.length === 0) return new Response(`No picks found for round ${round}.`, { status: 404 });
    const ids = picks.flatMap((p) => (p.playerId != null && p.playerId > 0 ? [p.playerId] : []));
    const headshots = ids.length ? await checkHeadshots(ids) : new Set<number>();
    const footer = seasonFooter(meta.name, meta.season);
    if (keepers) return await renderDraftRound({ round, picks, keepers, footer, headshots });
    return await renderPickCards({ title: `Draft Round ${round}`, picks, footer, headshots });
  } catch (err) {
    console.error("Draft round graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
