import { NextRequest, NextResponse } from "next/server";
import { getManagers, addManager, deleteManager } from "@/lib/content";

export async function GET() {
  const managers = await getManagers();
  return NextResponse.json(managers);
}

export async function POST(req: NextRequest) {
  const { name, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const id = await addManager(name.trim(), notes || null);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await deleteManager(id);
  return NextResponse.json({ ok: true });
}
