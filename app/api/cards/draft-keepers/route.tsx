import { NextRequest } from "next/server";
import { getDraftAssessment } from "@/lib/draft-assessment";
import { getLeagueMeta } from "@/lib/espn";
import { checkHeadshots } from "@/lib/headshots";
import { renderKeeperRanking, renderKeeperCards } from "@/lib/draft-keepers-image";
import { keeperTeams } from "@/lib/draft-teams";
import { seasonFooter } from "@/lib/portrait-graphics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public (no login) keeper graphics: /api/cards/draft-keepers = every team ranked, /api/cards/draft-keepers?team=Name = one team's keepers.
export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get("team");
    const [data, meta] = await Promise.all([getDraftAssessment(), getLeagueMeta()]);
    if (!data) return new Response("No saved draft for this season yet.", { status: 404 });
    const footer = seasonFooter(meta.name, meta.season);
    const teams = keeperTeams(data.picks);
    if (!team) {
      if (teams.length === 0) return new Response("No keepers found.", { status: 404 });
      return await renderKeeperRanking({ teams, footer });
    }
    const t = teams.find((x) => x.team === team);
    if (!t) return new Response(`No keepers found for ${team}.`, { status: 404 });
    const picks = data.picks.filter((p) => p.keeper && p.team === team).sort((a, b) => (b.vor ?? -Infinity) - (a.vor ?? -Infinity));
    const ids = picks.flatMap((p) => (p.playerId != null && p.playerId > 0 ? [p.playerId] : []));
    const headshots = ids.length ? await checkHeadshots(ids) : new Set<number>();
    return await renderKeeperCards({ team, vor: t.vor, picks, footer, headshots });
  } catch (err) {
    console.error("Draft keepers graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
