import { NextRequest } from "next/server";
import { getStandings, getLeagueMeta } from "@/lib/espn";
import { loadLogoData } from "@/lib/og-team-logo";
import { renderPortraitCover, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse } from "@/lib/captions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The newsletter's cover image. ?week=N picks the week; ?sections=A|B|C overrides the "in this issue" list
// (the Newsletter Graphics page sends its own list so the two always match).
const DEFAULT_SECTIONS = [
  "Weekly Scoreboard",
  "Standings",
  "Power Rankings",
  "3 Stars of the Week",
  "Top 3 Forwards",
  "Top 3 Defensemen",
  "Top 3 Goalies",
  "Team of the Week",
  "Player Spotlight",
  "Luck Chart",
  "Next Week's Matchups",
];

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });
    const meta = await getLeagueMeta();
    const sections = (req.nextUrl.searchParams.get("sections") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    const list = sections.length > 0 ? sections : DEFAULT_SECTIONS;

    if (req.nextUrl.searchParams.get("caption")) {
      return captionResponse([`${meta.name.toUpperCase()}`, `WEEK ${week} NEWSLETTER`, "", "In this issue:", ...list.map((s, i) => `${i + 1}. ${s}`), "", "#FantasyHockey"].join("\n"));
    }

    const [{ teams }, logos] = await Promise.all([getStandings(), loadLogoData(false)]);
    return await renderPortraitCover({
      week,
      leagueName: meta.name,
      seasonLabel: `${meta.season - 1}–${String(meta.season).slice(2)} SEASON`,
      sections: list,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      logos,
      footer: seasonFooter(meta.name, meta.season),
    });
  } catch (err) {
    console.error("Cover graphic failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
