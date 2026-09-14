import { NextRequest, NextResponse } from "next/server";
import { getTrades, addTrade, deleteTrade } from "@/lib/content";

export async function GET(req: NextRequest) {
  const seasonParam = req.nextUrl.searchParams.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;
  const trades = await getTrades(season);
  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const { season, playerName, fromManagerId, toManagerId, note } = await req.json();
  if (!season || !playerName?.trim()) {
    return NextResponse.json({ error: "season and playerName are required" }, { status: 400 });
  }
  await addTrade(season, playerName.trim(), fromManagerId || null, toManagerId || null, note || null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteTrade(id);
  return NextResponse.json({ ok: true });
}
