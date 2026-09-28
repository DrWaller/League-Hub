import { NextRequest, NextResponse } from "next/server";
import { getSeasonHistory, upsertSeasonHistory, deleteSeasonHistory } from "@/lib/content";

export async function GET() {
  return NextResponse.json(await getSeasonHistory());
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const season = Number(b.season);
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  await upsertSeasonHistory({
    season,
    champion: clean(b.champion),
    runnerUp: clean(b.runnerUp),
    regularSeasonLeader: clean(b.regularSeasonLeader),
    tags: Array.isArray(b.tags) ? b.tags.filter((t: unknown) => typeof t === "string" && t.trim()) : [],
    note: clean(b.note),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  await deleteSeasonHistory(season);
  return NextResponse.json({ ok: true });
}
