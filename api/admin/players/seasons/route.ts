import { NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { getHistorySeasons } from "@/lib/seasons";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { listImportedSeasons } from "@/lib/imported-seasons";

export const dynamic = "force-dynamic";

// Previous seasons the Player Cards page can offer: the ones in League History,
// minus any played on another platform -- unless that season was imported (then it is offered, marked as such).
export async function GET() {
  const meta = await getLeagueMeta();
  const [all, elsewhere, imported] = await Promise.all([getHistorySeasons(meta.season), getPlayedElsewhereSeasons(), listImportedSeasons()]);
  // ESPN seasons, plus any season brought in with the season importer (even though it was played elsewhere).
  const past = Array.from(new Set([...all.filter((s) => s !== meta.season && !elsewhere.has(s)), ...imported.filter((s) => s !== meta.season)])).sort((a, b) => b - a);
  return NextResponse.json({ current: meta.season, past, imported });
}
