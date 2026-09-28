import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { setTeamLogo, getTeamLogos } from "@/lib/content";

export async function GET() {
  const logos = await getTeamLogos();
  return NextResponse.json(logos);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const teamId = Number(form.get("teamId"));
  const file = form.get("file") as File | null;

  if (!teamId || !file) {
    return NextResponse.json({ error: "teamId and file are required" }, { status: 400 });
  }

  const blob = await put(`team-logos/team-${teamId}-${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  await setTeamLogo(teamId, blob.url);

  return NextResponse.json({ ok: true, url: blob.url });
}
