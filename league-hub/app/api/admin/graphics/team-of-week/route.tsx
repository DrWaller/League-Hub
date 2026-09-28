import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings } from "@/lib/espn";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { OG } from "@/lib/og-theme";
import { WeeklyPlayerStat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!week) return new Response("week is required", { status: 400 });

    const [{ players, live }, { teams }, fonts] = await Promise.all([
      getWeeklyPlayerStats(week),
      getStandings(),
      loadGraphicFonts(),
    ]);

    const { display, body } = getFontFamilies(fonts);

    if (!live) {
      return new Response("ESPN isn't connected, or no stats posted for this week yet.", { status: 400 });
    }

    const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? "";
    const byPos = (pos: string) => [...players].filter((p) => p.position === pos).sort((a, b) => b.points - a.points);

    const lineup: { slot: string; player: WeeklyPlayerStat | undefined }[] = [
      { slot: "LW", player: byPos("LW")[0] },
      { slot: "C", player: byPos("C")[0] },
      { slot: "RW", player: byPos("RW")[0] },
      { slot: "D", player: byPos("D")[0] },
      { slot: "G", player: byPos("G")[0] },
      { slot: "D", player: byPos("D")[1] },
    ];

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 820, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>Team of the Week</div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>Week {week}</div>
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
                    <div
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 38,
                        background: OG.rink,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: display,
                        fontSize: 26,
                        fontWeight: 700,
                        color: OG.ice,
                      }}
                    >
                      {slot.player.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: OG.board }}>{slot.player.name}</div>
                      <div style={{ fontSize: 13, color: OG.muted }}>{teamName(slot.player.teamId)}</div>
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
