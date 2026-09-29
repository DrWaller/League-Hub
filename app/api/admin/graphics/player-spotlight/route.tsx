import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings, getLeagueMeta, getPastSeasonTeams } from "@/lib/espn";
import { getPlayedElsewhereSeasons } from "@/lib/content";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { checkHeadshots, headshotUrl } from "@/lib/headshots";
import { PlayerAvatar } from "@/lib/og-avatar";
import { OG } from "@/lib/og-theme";
import { spotlightTiles } from "@/lib/espn-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSITION_GROUPS: Record<string, string[]> = {
  any: ["C", "LW", "RW", "D", "G"],
  forward: ["C", "LW", "RW"],
  defense: ["D"],
  goalie: ["G"],
};

const POSITION_NAMES: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goaltender",
};

// Player Spotlight: one featured player for the week -- by default the top
// fantasy scorer, optionally narrowed by position, or a specific player via
// ?playerId=, and a past season with ?season=. Add &debug=1 to get the raw ESPN stat ids as JSON instead.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const week = Number(params.get("week"));
    const position = (params.get("position") || "any").toLowerCase();
    const playerId = Number(params.get("playerId")) || null;
    if (!week || !POSITION_GROUPS[position]) {
      return new Response("week and a valid position (any, forward, defense, goalie) are required", { status: 400 });
    }

    // ?season=YYYY pulls a past season's completed weeks (same as the other
    // week-based graphics). Without it, this is the current season.
    const meta = await getLeagueMeta();
    const seasonParam = Number(params.get("season")) || meta.season;
    const isPast = seasonParam !== meta.season;

    if (isPast && (await getPlayedElsewhereSeasons()).has(seasonParam)) {
      return new Response(`${seasonParam} was played on Fantrax, so there's no ESPN player data to use.`, { status: 400 });
    }

    const [{ players, live, scoringPeriods, diag }, teamsResult, fonts] = await Promise.all([
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

    const pool = players
      .filter((p) => POSITION_GROUPS[position].includes(p.position))
      .sort((a, b) => b.points - a.points);
    const player = playerId ? players.find((p) => p.id === playerId) : pool[0];

    if (!player) {
      return new Response(
        (playerId ? "That player has no stats posted for this week." : "No stats posted for this week yet.") +
          `\n\nDiagnostics (send these to Claude if this looks wrong):\nseason=${seasonParam} week=${week} scoringDaysUsed=${JSON.stringify(scoringPeriods)}\n${JSON.stringify(diag)}`,
        { status: 400 }
      );
    }

    if (params.get("debug")) {
      return Response.json({
        week,
        scoringDaysUsed: scoringPeriods,
        player: { id: player.id, name: player.name, position: player.position, points: player.points },
        rawStats: player.stats ?? null,
        note: "Keys are ESPN stat ids. Compare against lib/espn-stats.ts.",
      });
    }

    const team = teamsResult.find((t) => t.id === player.teamId)?.name ?? "";
    const tiles = spotlightTiles(player.position, player.stats);
    const availableHeadshots = await checkHeadshots([player.id]);

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 640, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
              Player Spotlight
            </div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>Week {week}</div>
          </div>
          <div style={{ display: "flex", height: 3, background: OG.centerRed }} />
          <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "36px 48px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 44,
                width: "100%",
                background: "#FFFFFF",
                borderTop: `6px solid ${OG.gold}`,
                borderLeft: `1px solid ${OG.iceLine}`,
                borderRight: `1px solid ${OG.iceLine}`,
                borderBottom: `1px solid ${OG.iceLine}`,
                borderRadius: 8,
                padding: "40px 52px",
              }}
            >
              <PlayerAvatar
                name={player.name}
                src={headshotUrl(player.id)}
                hasHeadshot={availableHeadshots.has(player.id)}
                size={220}
                fontFamily={display}
                fontSize={76}
                border={`6px solid ${OG.gold}`}
              />
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 6 }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 16, fontWeight: 700, color: OG.gold, letterSpacing: 2 }}>
                  {(POSITION_NAMES[player.position] ?? player.position).toUpperCase()}
                </div>
                <div style={{ display: "flex", fontFamily: display, fontSize: 48, fontWeight: 700, color: OG.board, lineHeight: 1.1 }}>
                  {player.name}
                </div>
                <div style={{ display: "flex", fontSize: 20, color: OG.muted }}>{team}</div>
                <div style={{ display: "flex", fontFamily: display, fontSize: 36, fontWeight: 700, color: OG.centerRed, marginTop: 10 }}>
                  {player.points.toFixed(2)} pts
                </div>
                {tiles.length > 0 && (
                  <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                    {tiles.map((t) => (
                      <div
                        key={t.label}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          minWidth: 112,
                          background: OG.icePanel,
                          border: `1px solid ${OG.iceLine}`,
                          borderRadius: 6,
                          padding: "10px 16px",
                        }}
                      >
                        <div style={{ display: "flex", fontFamily: display, fontSize: 32, fontWeight: 700, color: OG.rink }}>{t.value}</div>
                        <div style={{ display: "flex", fontSize: 12, fontWeight: 600, color: OG.muted, letterSpacing: 1 }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 640, fonts }
    );
  } catch (err) {
    console.error("Graphics route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
