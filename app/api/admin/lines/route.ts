import { NextRequest, NextResponse } from "next/server";
import { getLines } from "@/lib/lines";

export const dynamic = "force-dynamic";

// Check what was read from Daily Faceoff: /api/admin/lines (summary) or ?team=OTT (that team's lines).
export async function GET(req: NextRequest) {
  const lines = await getLines();
  if (!lines) return NextResponse.json({ ok: false, error: "Couldn't read any team's lines from Daily Faceoff." }, { status: 502 });
  const team = req.nextUrl.searchParams.get("team")?.toUpperCase();
  return NextResponse.json({
    ok: true,
    updatedAt: lines.updatedAt,
    teamsOk: lines.teamsOk,
    teamsFailed: lines.teamsFailed,
    players: team ? lines.players.filter((p) => p.team === team) : lines.players.length,
  });
}
