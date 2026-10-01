import { NextRequest, NextResponse } from "next/server";
import { getPeriodProbe } from "@/lib/espn";

export const dynamic = "force-dynamic";

// Admin-only (covered by the /api/admin middleware). ?season=YYYY optional.
export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season")) || undefined;
  return NextResponse.json(await getPeriodProbe(season));
}
