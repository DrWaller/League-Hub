import { NextRequest, NextResponse } from "next/server";
import { getManagerSeasons, upsertManagerSeason, deleteManagerSeason } from "@/lib/content";

export async function GET(req: NextRequest) {
  const managerIdParam = req.nextUrl.searchParams.get("managerId");
  const managerId = managerIdParam ? Number(managerIdParam) : undefined;
  const seasons = await getManagerSeasons(managerId);
  return NextResponse.json(seasons);
}

export async function POST(req: NextRequest) {
  const { managerId, teamId, season, teamName, recordNote } = await req.json();
  if (!managerId || !teamId || !season || !teamName?.trim()) {
    return NextResponse.json({ error: "managerId, teamId, season, and teamName are required" }, { status: 400 });
  }
  await upsertManagerSeason(managerId, teamId, season, teamName.trim(), recordNote || null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteManagerSeason(id);
  return NextResponse.json({ ok: true });
}
