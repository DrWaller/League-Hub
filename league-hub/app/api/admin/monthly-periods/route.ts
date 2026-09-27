import { NextRequest, NextResponse } from "next/server";
import { getMonthlyPeriods, addMonthlyPeriod, deleteMonthlyPeriod } from "@/lib/content";

export async function GET(req: NextRequest) {
  const seasonParam = req.nextUrl.searchParams.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;
  const periods = await getMonthlyPeriods(season);
  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  const { season, label, startWeek, endWeek } = await req.json();
  if (!season || !label?.trim() || !startWeek || !endWeek) {
    return NextResponse.json({ error: "season, label, startWeek, and endWeek are required" }, { status: 400 });
  }
  await addMonthlyPeriod(season, label.trim(), startWeek, endWeek);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteMonthlyPeriod(id);
  return NextResponse.json({ ok: true });
}
