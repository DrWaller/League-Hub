import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { checkHeadshots, headshotUrl } from "@/lib/headshots";
import { PlayerAvatar } from "@/lib/og-avatar";
import { OG, NO_CACHE } from "@/lib/og-theme";
import { loadLogoData, TeamLine } from "@/lib/og-team-logo";
import { isPortrait, renderPortraitPlayerList, renderPortraitTeamOfWeek, renderPortraitSpotlight, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse, playersCaption, lineupCaption, standingsCaption, rankingsCaption, scoreboardCaption, previewCaption, luckCaption, weekLine, weekDatesText } from "@/lib/captions";
import { statLine } from "@/lib/espn-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSITION_GROUPS: Record<string, string[]> = {
  forward: ["C", "LW", "RW"],
  defense: ["D"],
  goalie: ["G"],
};

const POSITION_LABELS: Record<string, string> = {
  forward: "Forwards",
  defense: "Defensemen",
  goalie: "Goalies",
};

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    const position = (req.nextUrl.searchParams.get("position") || "forward").toLowerCase();
    if (!week || !POSITION_GROUPS[position]) {
      return new Response("week and a valid position (forward, defense, goalie) are required", { status: 400 });
    }

    // ?season=YYYY pulls a past season's already-completed weeks -- useful
    // for testing (or just generating) a graphic before the current season
    // has any stats posted yet. Without it, this is the current season.
    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }

    const [{ players, live }, teamsResult, fonts] = await Promise.all([
      getWeeklyPlayerStats(week, isPast ? seasonParam : undefined),
      isPast ? getPastSeasonTeams(seasonParam) : getStandings().then((s) => s.teams),
      loadGraphicFonts(),
    ]);

    const { display, body } = getFontFamilies(fonts);

    if (!live || !teamsResult) {
      return new Response(
        isPast ? `Couldn't load season ${seasonParam} from ESPN.` : "ESPN isn't connected, or no stats posted for this week yet.",
        { status: 400 }
      );
    }

    const logos = await loadLogoData(isPast);
    const teamName = (id: number) => teamsResult.find((t) => t.id === id)?.name ?? "";
    const top3 = players
      .filter((p) => POSITION_GROUPS[position].includes(p.position))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    const availableHeadshots = await checkHeadshots(top3.map((p) => p.id));

    const medalColors = [OG.gold, OG.silver, OG.bronze];
    const rankLabels = ["1ST", "2ND", "3RD"];

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(seasonParam, meta.season, week, await weekDatesText(seasonParam, meta.season, week));
      return captionResponse(
        playersCaption(`Top 3 ${POSITION_LABELS[position]}`, when, top3.map((p) => ({ name: p.name, team: teamName(p.teamId), points: p.points, line: statLine(p.position, p.stats) })))
      );
    }

    if (isPortrait(req.nextUrl.searchParams.get("format"))) {
      return await renderPortraitPlayerList({
        footer: seasonFooter(meta.name, seasonParam),
        title: `Top 3 ${POSITION_LABELS[position]}`,
        subtitle: isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`,
        players: top3.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId, teamName: teamName(p.teamId), points: p.points, statLine: statLine(p.position, p.stats) })),
        labels: rankLabels,
        colors: medalColors,
        emptyMessage: "No stats posted for this position/week yet.",
        logos,
        headshots: availableHeadshots,
      });
    }

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 640, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
              Top 3 {POSITION_LABELS[position]}
            </div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>{isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`}</div>
          </div>
          <div style={{ height: 3, background: OG.centerRed }} />
          <div style={{ flexGrow: 1, display: "flex", padding: "40px 48px", gap: 24 }}>
            {top3.map((p, i) => (
              <div
                key={p.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                  background: "#FFFFFF",
                  border: `1px solid ${OG.iceLine}`,
                  borderRadius: 12,
                  padding: "28px 20px",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: 16, left: 16, fontFamily: display, fontSize: 14, fontWeight: 700, color: medalColors[i] }}>
                  {rankLabels[i]}
                </div>
                <PlayerAvatar
                  name={p.name}
                  src={headshotUrl(p.id)}
                  hasHeadshot={availableHeadshots.has(p.id)}
                  size={96}
                  fontFamily={display}
                  fontSize={32}
                  border={`3px solid ${medalColors[i]}`}
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: OG.board }}>{p.name}</div>
                  <TeamLine name={teamName(p.teamId)} logo={logos[p.teamId]} size={18} fontSize={14} />
                </div>
                <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, color: OG.centerRed }}>{p.points.toFixed(2)} pts</div>
              </div>
            ))}
            {top3.length === 0 && (
              <div style={{ display: "flex", color: OG.muted, fontSize: 18 }}>No stats posted for this position/week yet.</div>
            )}
          </div>
        </div>
      ),
      { width: 1200, height: 640, fonts, headers: NO_CACHE }
    );
  } catch (err) {
    console.error("Graphics route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
