import { NextRequest, NextResponse } from "next/server";
import { runTierStudy } from "@/lib/tier-study";

export const dynamic = "force-dynamic";

// Aggregates only (no private data): how fixed points-per-game tier cutoffs line up with a finished season.
//   ?season=2025&minGp=20
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season")) || 2025;
  const minGp = Math.max(1, Number(req.nextUrl.searchParams.get("minGp")) || 20);
  const data = await runTierStudy(season, minGp).catch((e) => ({ error: String(e) }));
  if (!data) return NextResponse.json({ error: `No imported season ${season}` }, { status: 404 });
  if (req.nextUrl.searchParams.get("compact") && data && !("error" in data)) {
    // Just the shape: drop the long lists so several seasons can be compared at a glance.
    const d = data as Record<string, any>;
    for (const g of ["F", "D", "G"]) if (d[g]) { delete d[g].hist; for (const t of d[g].tiers ?? []) delete t.examples; delete d[g].bestFreeAgents; delete d[g].weakestRostered; }
  }
  return NextResponse.json(data);
}
