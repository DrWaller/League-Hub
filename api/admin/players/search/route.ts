import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/espn";
import { POSITION_LABEL } from "@/lib/radar";

export const dynamic = "force-dynamic";

// Name search for the Player Radar picker: /api/admin/players/search?q=mcdavid
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ players: [] });
  const found = await searchPlayers(q);
  return NextResponse.json({
    players: found.map((p) => ({ id: p.id, name: p.name, position: POSITION_LABEL[p.positionId] ?? "?" })),
  });
}
