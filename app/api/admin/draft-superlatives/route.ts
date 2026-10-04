import { NextRequest, NextResponse } from "next/server";
import { loadPicks, computeSuperlatives } from "@/lib/superlatives";
import { loadSheetMap } from "@/lib/player-sheet";

export const dynamic = "force-dynamic";

// Admin-only (covered by the /api/admin middleware).
// Open: /api/admin/draft-superlatives   (optional ?season=2027)
// Reads the stored draft_picks table; run draft-ingest first.
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season")) || 2027;
  try {
    const picks = await loadPicks(season);
    if (picks.length === 0) return NextResponse.json({ error: `No stored draft for ${season}. Run /api/admin/draft-ingest?run=1 first.` }, { status: 404 });
    return NextResponse.json({ season, ...computeSuperlatives(picks, await loadSheetMap()) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 400) }, { status: 500 });
  }
}
