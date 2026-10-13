import { NextRequest, NextResponse } from "next/server";
import { savedDraftSeasons, saveHistoryDraft } from "@/lib/draft-history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin-only. GET lists the saved drafts; POST {season} saves that past ESPN season's draft (one season per call).
export async function GET() {
  try {
    return NextResponse.json({ saved: await savedDraftSeasons() });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { season } = await req.json();
    const s = Number(season);
    if (!Number.isInteger(s) || s < 2000 || s > 2100) return NextResponse.json({ error: "Bad season." }, { status: 400 });
    return NextResponse.json({ season: s, ...(await saveHistoryDraft(s)) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, { status: 500 });
  }
}
