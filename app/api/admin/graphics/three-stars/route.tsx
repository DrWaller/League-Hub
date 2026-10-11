import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { checkHeadshots, headshotUrl } from "@/lib/headshots";
import { PlayerAvatar } from "@/lib/og-avatar";
import { OG, NO_CACHE } from "@/lib/og-theme";
import { loadLogoData, TeamLine } from "@/lib/og-team-logo";
import { isPortrait, renderPortraitThreeStars, seasonFooter } from "@/lib/portrait-graphics";
import { captionResponse, playersCaption, lineupCaption, standingsCaption, rankingsCaption, scoreboardCaption, previewCaption, luckCaption, weekLine, weekDatesText } from "@/lib/captions";
import { statLine } from "@/lib/espn-stats";
import { getWeekVor } from "@/lib/vor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    // ?season=YYYY pulls a past season's already-completed weeks -- useful
    // for testing (or just generating) a graphic before the current season
    // has any stats posted yet. Without it, this is the current season.
    const meta = await getLeagueMeta();
    const seasonParam = Number(req.nextUrl.searchParams.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }

    const [{ players, live }, teamsResult, fonts, vorWeek] = await Promise.all([
      getWeeklyPlayerStats(week, isPast ? seasonParam : undefined),
      isPast ? getPastSeasonTeams(seasonParam) : getStandings().then((s) => s.teams),
      loadGraphicFonts(),
      getWeekVor(week, seasonParam, meta.season).catch(() => null),
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
    // The stars are the most valuable players over replacement, so a goalie and a forward compete fairly.
    // (If VOR can't be worked out, fall back to raw points.)
    type Star = { id: number; name: string; position: string; teamId: number; points: number; stats?: Record<string, number>; vor?: number; gamesPlayed?: number };
    const top3: Star[] = vorWeek
      ? vorWeek.players.slice(0, 3)
      : [...players].sort((a, b) => b.points - a.points).slice(0, 3);
    const avgOf = (p: Star) => (p.gamesPlayed ? p.points / p.gamesPlayed : undefined);
    const availableHeadshots = await checkHeadshots(top3.map((p) => p.id));

    const medalColors = [OG.gold, OG.silver, OG.bronze];
    const labels = ["1ST STAR", "2ND STAR", "3RD STAR"];
    const heights = [320, 290, 260];

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(seasonParam, meta.season, week, await weekDatesText(seasonParam, meta.season, week));
      if (vorWeek) {
        const lines = top3.map(
          (p, i) => `${i + 1}) ${p.name} (${p.position}, ${teamName(p.teamId)}) - ${(p.vor ?? 0) >= 0 ? "+" : ""}${(p.vor ?? 0).toFixed(2)} VOR (${p.points.toFixed(2)} pts${avgOf(p) !== undefined ? `, ${avgOf(p)!.toFixed(2)} avg` : ""})${statLine(p.position, p.stats) ? `\n    ${statLine(p.position, p.stats)}` : ""}`
        );
        return captionResponse(["3 STARS OF THE WEEK", when, "", ...lines, "", "Ranked by value over replacement (points minus the last starter at the position)."].join("\n"));
      }
      return captionResponse(
        playersCaption("3 Stars of the Week", when, top3.map((p) => ({ name: p.name, team: teamName(p.teamId), points: p.points, line: statLine(p.position, p.stats) })))
      );
    }

    if (isPortrait(req.nextUrl.searchParams.get("format"))) {
      return await renderPortraitThreeStars({
        footer: seasonFooter(meta.name, seasonParam),
        title: "3 Stars of the Week",
        subtitle: isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`,
        players: top3.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId, teamName: teamName(p.teamId), points: p.points, statLine: statLine(p.position, p.stats), vor: p.vor, avg: avgOf(p) })),
        labels,
        colors: medalColors,
        emptyMessage: "No stats posted for this week yet.",
        logos,
        headshots: availableHeadshots,
      });
    }

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 640, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>3 Stars of the Week</div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>{isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`}</div>
          </div>
          <div style={{ height: 3, background: OG.centerRed }} />
          <div style={{ flexGrow: 1, display: "flex", padding: "40px 48px", gap: 24, alignItems: "flex-end" }}>
            {top3.map((p, i) => (
              <div
                key={p.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 12,
                  background: "#FFFFFF",
                  borderTop: `6px solid ${medalColors[i]}`,
                  borderLeft: `1px solid ${OG.iceLine}`,
                  borderRight: `1px solid ${OG.iceLine}`,
                  borderBottom: `1px solid ${OG.iceLine}`,
                  borderRadius: 8,
                  padding: "26px 20px",
                  height: heights[i],
                }}
              >
                <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: medalColors[i], letterSpacing: 1 }}>{labels[i]}</div>
                <PlayerAvatar
                  name={p.name}
                  src={headshotUrl(p.id)}
                  hasHeadshot={availableHeadshots.has(p.id)}
                  size={88}
                  fontFamily={display}
                  fontSize={30}
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: OG.board }}>{p.name}</div>
                  <TeamLine name={teamName(p.teamId)} logo={logos[p.teamId]} size={16} fontSize={13} />
                </div>
                <div style={{ display: "flex", fontFamily: display, fontSize: 24, fontWeight: 700, color: OG.centerRed }}>{p.points.toFixed(2)} pts</div>
              </div>
            ))}
            {top3.length === 0 && (
              <div style={{ display: "flex", color: OG.muted, fontSize: 18 }}>No stats posted for this week yet.</div>
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
