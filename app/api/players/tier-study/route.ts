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
  return NextResponse.json(data);
}
