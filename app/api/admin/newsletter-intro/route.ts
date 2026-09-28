import { NextRequest, NextResponse } from "next/server";
import { getNewsletterIntro, upsertNewsletterIntro } from "@/lib/content";
import { NewsletterPeriodType } from "@/lib/types";

export async function GET(req: NextRequest) {
  const season = Number(req.nextUrl.searchParams.get("season"));
  const periodType = req.nextUrl.searchParams.get("periodType") as NewsletterPeriodType | null;
  const periodKey = req.nextUrl.searchParams.get("periodKey");
  if (!season || !periodType || !periodKey) {
    return NextResponse.json({ error: "season, periodType, and periodKey are required" }, { status: 400 });
  }
  const intro = await getNewsletterIntro(season, periodType, periodKey);
  return NextResponse.json({ introText: intro?.introText ?? "" });
}

export async function POST(req: NextRequest) {
  const { season, periodType, periodKey, introText } = await req.json();
  if (!season || !periodType || !periodKey) {
    return NextResponse.json({ error: "season, periodType, and periodKey are required" }, { status: 400 });
  }
  await upsertNewsletterIntro(season, periodType, periodKey, introText || "");
  return NextResponse.json({ ok: true });
}
