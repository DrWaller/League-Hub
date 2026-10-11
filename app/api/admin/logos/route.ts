import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { setTeamLogo, getTeamLogos, setTeamBannerColors } from "@/lib/content";
import { isHexColor } from "@/lib/banner-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vercel rejects request bodies over about 4.5 MB, so stay under that.
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET() {
  const logos = await getTeamLogos();
  return NextResponse.json(logos);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const teamId = Number(form.get("teamId"));
    const file = form.get("file") as File | null;

    if (!teamId || !file) {
      return NextResponse.json({ error: "teamId and file are required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `That file isn't an image (${file.type || "unknown type"}). Use a PNG, JPEG or GIF.` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `That image is ${(file.size / 1048576).toFixed(1)} MB. Keep it under 4 MB.` }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN isn't set. In Vercel, connect a public Blob store with the read-write token option ticked, then redeploy." },
        { status: 500 }
      );
    }

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const blob = await put(`team-logos/team-${teamId}-${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type,
    });

    await setTeamLogo(teamId, blob.url);

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    // Say what actually went wrong instead of an empty failure.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Logo upload failed", err);
    return NextResponse.json({ error: `Logo upload failed: ${message}` }, { status: 500 });
  }
}

// Saves a team's banner colours (used for its Regular Season / Champions banners).
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const teamId = Number(body?.teamId);
    if (!teamId || !isHexColor(body?.primary) || !isHexColor(body?.trim)) {
      return NextResponse.json({ error: "teamId and two colours like #123A61 are required" }, { status: 400 });
    }
    await setTeamBannerColors(teamId, body.primary, body.trim);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Saving banner colours failed", err);
    return NextResponse.json({ error: `Saving colours failed: ${message}` }, { status: 500 });
  }
}
