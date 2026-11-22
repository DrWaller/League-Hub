import { NextRequest } from "next/server";
import { getDraftAssessment } from "@/lib/draft-assessment";
import { splitValue, type ValueKind } from "@/lib/draft-value-split";
import { getLeagueMeta } from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { renderValueCards } from "@/lib/draft-card-image";
import { seasonFooter } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) graphic: /api/cards/draft-value?kind=steals | busts | missed
export async function GET(req: NextRequest) {
  try {
    const kind = (req.nextUrl.searchParams.get("kind") || "").toLowerCase() as ValueKind;
    if (!["steals", "busts", "missed"].includes(kind)) return new Response("kind must be steals, busts or missed", { status: 400 });
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    if (!data) return new Response("No saved draft for this season yet.", { status: 404 });
    const picks = splitValue(data.picks)[kind];
    if (picks.length === 0) return new Response("Nothing to show yet.", { status: 404 });
    const ids = picks.flatMap((p) => (p.playerId != null && p.playerId > 0 ? [p.playerId] : []));
    const headshots = ids.length ? await checkHeadshots(ids) : new Set<number>();
    return await renderValueCards({ kind, picks, footer: seasonFooter(meta.name, meta.season), headshots });
  } catch (err) {
    console.error("Draft value graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
