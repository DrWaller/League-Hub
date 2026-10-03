import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { checkHeadshots, headshotUrl } from "@/lib/headshots";
import { PlayerAvatar } from "@/lib/og-avatar";
import { OG } from "@/lib/og-theme";
import { loadLogoData, TeamLine } from "@/lib/og-team-logo";
import { isPortrait, renderPortraitPlayerList, renderPortraitTeamOfWeek, renderPortraitSpotlight, seasonFooter } from "@/lib/portrait-graphics";
import { WeeklyPlayerStat } from "@/lib/types";
import { captionResponse, playersCaption, lineupCaption, standingsCaption, rankingsCaption, scoreboardCaption, previewCaption, luckCaption, weekLine, weekDatesText } from "@/lib/captions";

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
    const byPos = (pos: string) => [...players].filter((p) => p.position === pos).sort((a, b) => b.points - a.points);

    const lineup: { slot: string; player: WeeklyPlayerStat | undefined }[] = [
      { slot: "LW", player: byPos("LW")[0] },
      { slot: "C", player: byPos("C")[0] },
      { slot: "RW", player: byPos("RW")[0] },
      { slot: "D", player: byPos("D")[0] },
      { slot: "G", player: byPos("G")[0] },
      { slot: "D", player: byPos("D")[1] },
    ];

    const availableHeadshots = await checkHeadshots(
      lineup.map((l) => l.player?.id).filter((id): id is number => id !== undefined)
    );

    if (req.nextUrl.searchParams.get("caption")) {
      const when = weekLine(seasonParam, meta.season, week, await weekDatesText(seasonParam, meta.season, week));
      return captionResponse(
        lineupCaption(
          when,
          lineup
            .filter((l) => l.player)
            .map((l) => ({ slot: l.slot, name: l.player!.name, team: teamName(l.player!.teamId), points: l.player!.points }))
        )
      );
    }

    if (isPortrait(req.nextUrl.searchParams.get("format"))) {
      return await renderPortraitTeamOfWeek({
        footer: seasonFooter(meta.name, seasonParam),
        subtitle: isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`,
        lineup: lineup.map((l) => ({
          slot: l.slot,
          player: l.player
            ? { id: l.player.id, name: l.player.name, teamId: l.player.teamId, teamName: teamName(l.player.teamId), points: l.player.points }
            : undefined,
        })),
        logos,
        headshots: availableHeadshots,
      });
    }

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 820, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>Team of the Week</div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>{isPast ? `${seasonParam} - Week ${week}` : `Week ${week}`}</div>
          </div>
          <div style={{ height: 3, background: OG.centerRed }} />
          <div style={{ flexGrow: 1, display: "flex", flexWrap: "wrap", padding: "36px 48px", gap: 24 }}>
            {lineup.map((slot, i) => (
              <div
                key={i}
                style={{
                  width: 352,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  background: "#FFFFFF",
                  border: `1px solid ${OG.iceLine}`,
                  borderRadius: 12,
                  padding: "22px 18px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontFamily: display,
                    fontSize: 13,
                    fontWeight: 700,
                    color: OG.ice,
                    background: OG.centerRed,
                    padding: "3px 10px",
                    borderRadius: 4,
                  }}
                >
                  {slot.slot}
                </div>
                {slot.player ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <PlayerAvatar
                      name={slot.player.name}
                      src={headshotUrl(slot.player.id)}
                      hasHeadshot={availableHeadshots.has(slot.player.id)}
                      size={76}
                      fontFamily={display}
                      fontSize={26}
                    />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: OG.board }}>{slot.player.name}</div>
                      <TeamLine name={teamName(slot.player.teamId)} logo={logos[slot.player.teamId]} size={16} fontSize={13} />
                    </div>
                    <div style={{ display: "flex", fontFamily: display, fontSize: 22, fontWeight: 700, color: OG.centerRed }}>
                      {slot.player.points.toFixed(2)} pts
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", color: OG.muted, fontSize: 14, padding: "30px 0" }}>No data</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 1200, height: 820, fonts }
    );
  } catch (err) {
    console.error("Graphics route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
