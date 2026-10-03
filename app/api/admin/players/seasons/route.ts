import { NextResponse } from "next/server";
import { getLeagueMeta } from "@/lib/espn";
import { getHistorySeasons } from "@/lib/seasons";
import { getPlayedElsewhereSeasons } from "@/lib/content";

export const dynamic = "force-dynamic";

// Previous seasons the Player Cards page can offer: the ones in League History,
// minus any played on another platform (ESPN has no player data for those).
export async function GET() {
  const meta = await getLeagueMeta();
  const [all, elsewhere] = await Promise.all([getHistorySeasons(meta.season), getPlayedElsewhereSeasons()]);
  const past = all.filter((s) => s !== meta.season && !elsewhere.has(s)).sort((a, b) => b - a);
  return NextResponse.json({ current: meta.season, past });
}
