import { NextRequest, NextResponse } from "next/server";
import { getLeagueMeta, getPlayerPool, getScoringItems } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { categoriesFor, minGamesFor, perGame, POSITION_LABEL, type Group, type PoolPlayer } from "@/lib/radar";

export const dynamic = "force-dynamic";

// Players in rank order, to pick one for a card.
//   ?group=all|F|D|G   who to rank (all = forwards, defensemen and goalies together)
//   ?by=total|avg|stat:<id>   fantasy points, fantasy points per game, or one scoring category per game
//   ?season=YYYY   a previous season's final ranking (default: the current season so far)
//   ?start=N&limit=N   the page of the ranking to return (start is a rank, 1 = best)
// Only players who have played the minimum games count, like the cards.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const groupParam = params.get("group") ?? "all";
  const by = params.get("by") ?? "total";
  const start = Math.max(1, Number(params.get("start")) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || 12));

  const meta = await getLeagueMeta();
  const seasonParam = Number(params.get("season")) || meta.season;
  const isPast = seasonParam !== meta.season;
  const season = isPast ? seasonParam : undefined; // undefined = the current season in the ESPN helpers
  if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
    return NextResponse.json({ players: [], total: 0, categories: [], error: `${seasonParam} was played on Fantrax, so ESPN has no player data for it.` });
  }

  const groups: Group[] = groupParam === "F" || groupParam === "D" || groupParam === "G" ? [groupParam] : ["F", "D", "G"];
  const pools = await Promise.all(groups.map((g) => getPlayerPool(g, season)));

  // The league's scoring categories for a single group (they can be ranked by too).
  let categories: { id: string; label: string }[] = [];
  let cat: ReturnType<typeof categoriesFor>[number] | undefined;
  if (groups.length === 1) {
    const cats = categoriesFor(groups[0], await getScoringItems(season));
    categories = cats.map((c) => ({ id: c.statId, label: c.label }));
    if (by.startsWith("stat:")) cat = cats.find((c) => c.statId === by.slice(5));
  }

  const entries: { p: PoolPlayer; value: number }[] = [];
  groups.forEach((g, i) => {
    const min = minGamesFor(pools[i], Number(params.get("minGames")) || undefined, isPast ? 20 : 15);
    for (const p of pools[i]) {
      if (p.gp < min) continue;
      const value = cat ? perGame(p, cat) : by === "avg" ? (p.gp > 0 ? p.appliedTotal / p.gp : 0) : p.appliedTotal;
      entries.push({ p, value });
    }
  });
  const lowerIsBetter = cat ? !cat.higherIsBetter : false;
  entries.sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));

  const label = (v: number) => (cat ? (cat.rate ? v.toFixed(v < 1 ? 3 : 2) : `${v.toFixed(2)}/gm`) : by === "avg" ? `${v.toFixed(2)}/gm` : `${v.toFixed(1)} pts`);
  const page = entries.slice(start - 1, start - 1 + limit).map((e, i) => ({
    rank: start + i,
    id: e.p.id,
    name: e.p.name,
    position: POSITION_LABEL[e.p.positionId] ?? "?",
    gp: e.p.gp,
    total: e.p.appliedTotal,
    avg: e.p.gp > 0 ? e.p.appliedTotal / e.p.gp : 0,
    valueLabel: label(e.value),
  }));

  return NextResponse.json({ players: page, total: entries.length, categories });
}
