import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getWeeklyPlayerStats, getStandings } from "@/lib/espn";
import { loadGraphicFonts, getFontFamilies } from "@/lib/og-fonts";
import { checkHeadshots, headshotUrl } from "@/lib/headshots";
import { PlayerAvatar } from "@/lib/og-avatar";
import { OG } from "@/lib/og-theme";

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
    const top3 = players
      .filter((p) => POSITION_GROUPS[position].includes(p.position))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    const availableHeadshots = await checkHeadshots(top3.map((p) => p.id));

    const medalColors = [OG.gold, OG.silver, OG.bronze];
    const rankLabels = ["1ST", "2ND", "3RD"];

    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 640, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
          <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
              Top 3 {POSITION_LABELS[position]}
            </div>
            <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>Week {week}</div>
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
                  <div style={{ fontSize: 14, color: OG.muted }}>{teamName(p.teamId)}</div>
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
      { width: 1200, height: 640, fonts }
    );
  } catch (err) {
    console.error("Graphics route failed", err);
    return new Response("Graphics generation failed: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
