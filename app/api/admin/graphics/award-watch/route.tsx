import { NextRequest } from "next/server";
import { getLeagueMeta, getStandings } from "@/lib/espn";
import { syncSeasonVor } from "@/lib/vor-store";
import { PLAYER_AWARDS, getPlayerRaces } from "@/lib/season-awards";
import { checkHeadshots } from "@/lib/headshots";
import { loadLogoData } from "@/lib/og-team-logo";
import { graphicTiers } from "@/lib/og-tier";
import { OG } from "@/lib/og-theme";
import { renderPortraitPlayerList, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Norris Watch" etc.: the top 3 of a season-long player award race, through the last finished week
// (or ?week=N). ?award= is one of hart, norris, vezina, forward, artross.
export async function GET(req: NextRequest) {
  try {
    const key = (req.nextUrl.searchParams.get("award") || "").toLowerCase();
    const award = PLAYER_AWARDS.find((a) => a.key === key);
    if (!award) return new Response(`award must be one of: ${PLAYER_AWARDS.map((a) => a.key).join(", ")}`, { status: 400 });
    const meta = await getLeagueMeta();
    await syncSeasonVor(meta.season, meta.currentWeek).catch(() => null);
    const week = Number(req.nextUrl.searchParams.get("week")) || undefined;
    const race = (await getPlayerRaces(meta.season, week, 3)).find((r) => r.award.key === award.key);
    if (!race || race.entries.length === 0) return new Response("No finished weeks saved yet, so there's no race to show.", { status: 400 });

    const { teams } = await getStandings();
    const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? "";
    const through = race.through;

    if (req.nextUrl.searchParams.get("caption")) {
      const lines = race.entries.map((e, i) => `${i + 1}) ${e.name} (${teamName(e.teamId)}) - ${award.metric === "vor" ? `${e.vor >= 0 ? "+" : ""}${e.vor.toFixed(2)} VOR (${e.points.toFixed(2)} pts)` : `${e.points.toFixed(2)} pts`}`);
      return captionResponse([award.watch.toUpperCase(), `Season to date - through week ${through}`, "", ...lines, "", "#FantasyHockey"].join("\n"));
    }

    const [logos, tierIdx, headshots] = await Promise.all([loadLogoData(false), graphicTiers(false), checkHeadshots(race.entries.map((e) => e.id))]);
    return await renderPortraitPlayerList({
      footer: seasonFooter(meta.name, meta.season),
      title: award.watch,
      subtitle: `Season to date - through week ${through}`,
      players: race.entries.map((e) => ({
        id: e.id,
        name: e.name,
        teamId: e.teamId,
        teamName: teamName(e.teamId),
        points: e.points,
        vor: award.metric === "vor" ? e.vor : undefined,
        tier: tierIdx[e.id] ?? null,
      })),
      labels: ["1ST", "2ND", "3RD"],
      colors: [OG.gold, OG.silver, OG.bronze],
      emptyMessage: "No finished weeks yet.",
      logos,
      headshots,
    });
  } catch (err) {
    console.error("Award watch graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
