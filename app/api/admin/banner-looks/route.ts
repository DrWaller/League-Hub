import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { setTeamSeasonLogo, setTeamSeasonColors, deleteTeamSeasonLook } from "@/lib/content";
import { isHexColor } from "@/lib/banner-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;

const validKey = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120;

// Upload the logo a team used in one season.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const season = Number(form.get("season"));
    const teamKey = form.get("teamKey");
    const file = form.get("file") as File | null;
    if (!season || !validKey(teamKey) || !file) {
      return NextResponse.json({ error: "season, teamKey and file are required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `That file isn't an image (${file.type || "unknown type"}).` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `That image is ${(file.size / 1048576).toFixed(1)} MB. Keep it under 4 MB.` }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN isn't set, so images can't be stored." }, { status: 500 });
    }
    const safe = teamKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const blob = await put(`team-logos/season-${season}-${safe}-${Date.now()}`, file, {
      access: "public",
      contentType: file.type,
    });
    await setTeamSeasonLogo(season, teamKey, blob.url);
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Season logo upload failed", err);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}

// Save the colours a team used in one season.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const season = Number(body?.season);
    const text: string | null = body?.text ? String(body.text) : null; // empty = automatic
    if (!season || !validKey(body?.teamKey) || !isHexColor(body?.primary) || !isHexColor(body?.trim) || (text !== null && !isHexColor(text))) {
      return NextResponse.json({ error: "season, teamKey and two colours like #123A61 are required" }, { status: 400 });
    }
    await setTeamSeasonColors(season, body.teamKey, body.primary, body.trim, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Saving season colours failed", err);
    return NextResponse.json({ error: `Saving failed: ${message}` }, { status: 500 });
  }
}

// Forget a season's look, so its banner goes back to the team's general look.
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const season = Number(body?.season);
    if (!season || !validKey(body?.teamKey)) {
      return NextResponse.json({ error: "season and teamKey are required" }, { status: 400 });
    }
    await deleteTeamSeasonLook(season, body.teamKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Reset failed: ${message}` }, { status: 500 });
  }
}
