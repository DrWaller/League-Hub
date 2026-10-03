import { ImageResponse } from "next/og";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { TeamBadge } from "./og-team-logo";

// Weekly matchup preview: every game of an upcoming week with each team's
// record and power-ranking spot going in. Landscape here; the portrait
// version lives in lib/portrait-graphics.tsx. Same Satori rules as the rest.

export interface PreviewSide {
  teamId: number;
  name: string;
  record: string; // "3-1" (precomputed)
  rank?: number; // power-ranking position going into the week
}
export interface PreviewGame {
  home: PreviewSide;
  away: PreviewSide;
  series?: string; // all-time head-to-head, e.g. "EVAN LEADS 5-3"
}

export const sideLine = (s: PreviewSide) => (s.rank ? `#${s.rank} power rank - ${s.record}` : s.record);

export async function renderPreview(opts: { games: PreviewGame[]; week: number; logos?: Record<number, string> }) {
  const { games, week } = opts;
  const logos = opts.logos ?? {};
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);

  const ROW_H = 88;
  const height = 132 + 3 + 28 + games.length * ROW_H + 64;

  const side = (s: PreviewSide, align: "flex-start" | "flex-end") => (
    <div style={{ display: "flex", width: 430, alignItems: "center", justifyContent: align, gap: 14 }}>
      {align === "flex-start" ? <TeamBadge name={s.name} logo={logos[s.teamId]} size={56} fontFamily={display} /> : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: align, maxWidth: 340 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: OG.board, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 340 }}>
          {s.name}
        </div>
        <div style={{ display: "flex", fontSize: 15, color: OG.muted }}>{sideLine(s)}</div>
      </div>
      {align === "flex-end" ? <TeamBadge name={s.name} logo={logos[s.teamId]} size={56} fontFamily={display} /> : null}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
            {`Week ${week} matchups`}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>Records and power rankings going in - all-time series in the middle</div>
        </div>
        <div style={{ height: 3, background: OG.centerRed }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "28px 48px 0 48px" }}>
          {games.map((g, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: ROW_H, gap: 14, background: i % 2 === 0 ? "#FFFFFF" : OG.icePanel }}>
              {side(g.home, "flex-end")}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 160 }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 20, fontWeight: 700, color: OG.centerRed }}>VS</div>
                {g.series ? <div style={{ display: "flex", fontFamily: display, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: OG.rink, marginTop: 2 }}>{g.series}</div> : null}
              </div>
              {side(g.away, "flex-start")}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
