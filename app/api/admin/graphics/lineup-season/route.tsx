import { NextRequest } from "next/server";
import { getStandings, getMatchups, getLeagueMeta } from "@/lib/espn";
import { regularSeasonFinals } from "@/lib/luck";
import { syncSeasonLineups, getStoredLineups, summarizeSeason } from "@/lib/lineup-store";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitLineupEfficiency, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Season-long lineup efficiency (regular season): the "best manager" race, or the final award graphic.
export async function GET(req: NextRequest) {
  try {
    const meta = await getLeagueMeta();
    const [{ teams }, { matchups }] = await Promise.all([getStandings(), getMatchups()]);
    const finished = Array.from(new Set(regularSeasonFinals(matchups).map((m) => m.week)));
    const through = Number(req.nextUrl.searchParams.get("week")) || Math.max(0, ...finished);
    const weeks = finished.filter((w) => w <= through);
    if (weeks.length === 0) return new Response("No finished weeks yet.", { status: 400 });

    const sync = await syncSeasonLineups(meta.season, weeks);
    const { teams: rows } = summarizeSeason((await getStoredLineups(meta.season)).filter((r) => r.week <= through));
    if (rows.length === 0) return new Response("Couldn't load any weeks' daily lineups from ESPN.", { status: 400 });

    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    const out = rows.map((r) => ({ teamId: r.teamId, name: name(r.teamId), actual: r.actual, max: r.max }));
    const complete = sync.waiting === 0 && sync.failed.length === 0;

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = out.map((r, i) => `${i + 1}. ${r.name}: ${((r.actual / r.max) * 100).toFixed(1)}% (${r.actual.toFixed(2)} of ${r.max.toFixed(2)})`);
      return captionResponse(["BEST MANAGER RACE", `Season lineup efficiency through week ${through}`, "", ...lines, "", "#FantasyHockey"].join("\n"));
    }
    const logos = await loadLogoData(false);
    return await renderPortraitLineupEfficiency({
      week: through,
      title: "Best Manager Race",
      subtitle: complete ? `Season lineup efficiency - through week ${through}` : `Through week ${through} - ${sync.waiting + sync.failed.length} week(s) still loading, refresh`,
      rows: out,
      logos,
      footer: seasonFooter(meta.name, meta.season),
    });
  } catch (err) {
    console.error("Season lineup graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
