import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { runPickupSyncStep, getPickupCounts, resetPickupData } from "@/lib/pickup-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST: one update step (call again until result.done). ?reset=1 first wipes this season's saved pickup data.
export async function POST(req: NextRequest) {
  const meta = await getLeagueMeta();
  if (req.nextUrl.searchParams.get("reset") === "1") await resetPickupData(meta.season);
  const result = await runPickupSyncStep();
  const counts = await getPickupCounts(meta.season);
  return NextResponse.json({ result, counts });
}

export async function GET() {
  const meta = await getLeagueMeta();
  return NextResponse.json({ counts: await getPickupCounts(meta.season) });
}
