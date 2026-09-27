import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings } from "@/lib/espn";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { OG } from "@/lib/og-theme";

export const runtime = "nodejs";

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
    const top3 = [...players].sort((a, b) => b.points - a.points).slice(0, 3);

    const medalColors = [OG.gold, OG.silver, OG.bronze];
    const labels = ["1ST STAR", "2ND STAR", "3RD STAR"];
    const heights = [320, 290, 260];

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 640, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>3 Stars of the Week</div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>Week {week}</div>
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
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    background: OG.rink,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: display,
                    fontSize: 30,
                    fontWeight: 700,
                    color: OG.ice,
                  }}
                >
                  {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: OG.board }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: OG.muted }}>{teamName(p.teamId)}</div>
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
      { width: 1200, height: 640, fonts }
    );
  } catch (err) {
    console.error("Graphics route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
