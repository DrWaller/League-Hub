import { NextRequest } from "next/server";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { getWeekLineups } from "@/lib/lineup-efficiency";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitLineupEfficiency, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How close each team's lineup came to the best one it could have set that week (current season).
export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });
    const meta = await getLeagueMeta();
    const [{ teams }, lineups] = await Promise.all([getStandings(), getWeekLineups(week, meta.season, meta.season)]);
    if (!lineups) return new Response("Couldn't load that week's daily lineups from ESPN (not connected, or no games yet).", { status: 400 });

    const name = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    const rows = lineups.teams
      .filter((t) => t.max > 0)
      .map((t) => ({ teamId: t.teamId, name: name(t.teamId), actual: t.actual, max: t.max }))
      // Efficiency first; ties (e.g. two teams at 100%) go to the team with more points that week.
      .sort((a, b) => {
        const d = b.actual / b.max - a.actual / a.max;
        return Math.abs(d) < 1e-9 ? b.actual - a.actual : d;
      });

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = rows.map((r, i) => `${i + 1}. ${r.name}: ${r.actual.toFixed(2)} of ${r.max.toFixed(2)} (${((r.actual / r.max) * 100).toFixed(1)}%)`);
      return captionResponse(["LINEUP EFFICIENCY", `Week ${week} - points scored vs. the best possible lineup`, "", ...lines, "", "#FantasyHockey"].join("\n"));
    }

    const logos = await loadLogoData(false);
    return await renderPortraitLineupEfficiency({ week, rows, logos, footer: seasonFooter(meta.name, meta.season) });
  } catch (err) {
    console.error("Lineup efficiency graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
