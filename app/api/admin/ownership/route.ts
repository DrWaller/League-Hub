import { NextRequest, NextResponse } from "next/server";
import { ownershipStatus, saveSeasonOwnership } from "@/lib/ownership";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only. GET lists which seasons' rosters are saved; POST {season} reads and saves that season (replacing it).
export async function GET() {
  try {
    return NextResponse.json({ saved: await ownershipStatus() });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = Number((await req.json()).season);
    if (!Number.isInteger(s) || s < 2000 || s > 2100) return NextResponse.json({ error: "Bad season." }, { status: 400 });
    return NextResponse.json({ season: s, ...(await saveSeasonOwnership(s)) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}
