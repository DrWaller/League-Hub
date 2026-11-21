import { NextRequest } from "next/server";
import { getDraftAssessment } from "@/lib/draft-assessment";
import { getLeagueMeta } from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { renderDraftPick } from "@/lib/draft-pick-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) card for one draft pick: /api/cards/draft-pick?pick=7 (the overall pick number).
export async function GET(req: NextRequest) {
  try {
    const n = Number(req.nextUrl.searchParams.get("pick"));
    if (!Number.isInteger(n) || n < 1) return new Response("pick must be a number", { status: 400 });
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    const pick = data?.picks.find((p) => p.overall === n);
    if (!data || !pick) return new Response(`No pick #${n} found.`, { status: 404 });
    const ok = pick.playerId != null && pick.playerId > 0 ? (await checkHeadshots([pick.playerId])).has(pick.playerId) : false;
    return await renderDraftPick({ pick, hasHeadshot: ok, footer: `${meta.name.toUpperCase()} · ${meta.season - 1}–${String(meta.season).slice(2)}` });
  } catch (err) {
    console.error("Draft pick card failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
