import { NextRequest, NextResponse } from "next/server";
import { getKeepers, addKeeper, deleteKeeper } from "@/lib/content";

export async function GET(req: NextRequest) {
  const seasonParam = req.nextUrl.searchParams.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;
  const keepers = await getKeepers(season);
  return NextResponse.json(keepers);
}

export async function POST(req: NextRequest) {
  const { season, teamId, playerName, note } = await req.json();
  if (!season || !teamId || !playerName) {
    return NextResponse.json({ error: "season, teamId, and playerName are required" }, { status: 400 });
  }
  await addKeeper(season, teamId, playerName, note || null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteKeeper(id);
  return NextResponse.json({ ok: true });
}
