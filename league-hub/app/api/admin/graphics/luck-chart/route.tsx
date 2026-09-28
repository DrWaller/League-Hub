import { NextRequest } from "next/server";
import { getMatchups, getStandings } from "@/lib/espn";
import { computeLuck } from "@/lib/luck";
import { renderLuckChart } from "@/lib/luck-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    // No week argument = the whole season's schedule in one ESPN call;
    // computeLuck filters to final games through the requested week.
    const [{ matchups, live }, { teams }] = await Promise.all([getMatchups(), getStandings()]);

    if (!live) {
      return new Response("ESPN isn't connected, so there are no real results to chart.", { status: 400 });
    }

    const { rows, leagueMedian } = computeLuck(matchups, week);
    if (rows.length === 0) {
      return new Response(`No final matchups through week ${week} yet.`, { status: 400 });
    }

    const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    return await renderLuckChart({ rows, leagueMedian, week, teamName });
  } catch (err) {
    console.error("Luck chart route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
