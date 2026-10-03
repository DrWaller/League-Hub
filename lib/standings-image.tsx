import { ImageResponse } from "next/og";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { TeamBadge } from "./og-team-logo";

// Standings graphic. Landscape here; the portrait version lives in
// lib/portrait-graphics.tsx. Same Satori rules as the other graphics.

export interface StandingsRow {
  teamId: number;
  name: string;
  record: string; // "5-2" or "5-2-1" (precomputed)
  pf: number;
  pa: number;
  streak?: string;
}

export const fmtPts = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtDiff = (n: number) => `${n > 0 ? "+" : ""}${fmtPts(n)}`;

const COLS = [
  { label: "#", width: 70, align: "center" as const },
  { label: "Team", width: 440, align: "flex-start" as const },
  { label: "Record", width: 130, align: "center" as const },
  { label: "PF", width: 130, align: "center" as const },
  { label: "PA", width: 130, align: "center" as const },
  { label: "Diff", width: 120, align: "center" as const },
  { label: "Streak", width: 90, align: "center" as const },
];

export async function renderStandings(opts: { rows: StandingsRow[]; title: string; subtitle: string; logos?: Record<number, string> }) {
  const logos = opts.logos ?? {};
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);

  const ROW_H = 58;
  const height = 132 + 3 + 24 + 40 + opts.rows.length * ROW_H + 40;

  const cells = opts.rows.map((r, i) => ({
    row: r,
    bg: i === 0 ? "#FFF8E6" : i % 2 === 0 ? "#FFFFFF" : OG.icePanel,
    diff: r.pf - r.pa,
  }));

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>{opts.title}</div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>{opts.subtitle}</div>
        </div>
        <div style={{ height: 3, background: OG.centerRed }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "24px 48px 0 48px" }}>
          <div style={{ display: "flex", borderBottom: `2px solid ${OG.rink}`, height: 40, alignItems: "center" }}>
            {COLS.map((c) => (
              <div key={c.label} style={{ display: "flex", width: c.width, justifyContent: c.align, fontFamily: display, fontSize: 13, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
                {c.label}
              </div>
            ))}
          </div>
          {cells.map(({ row, bg, diff }, i) => (
            <div key={row.teamId} style={{ display: "flex", height: ROW_H, alignItems: "center", background: bg }}>
              <div style={{ display: "flex", width: 70, justifyContent: "center", fontSize: 22, fontWeight: 700, color: i === 0 ? OG.goldText : OG.rink }}>{i + 1}</div>
              <div style={{ display: "flex", width: 440, alignItems: "center", gap: 14 }}>
                <TeamBadge name={row.name} logo={logos[row.teamId]} size={38} fontFamily={display} />
                <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: OG.board, maxWidth: 370, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{row.name}</div>
              </div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 20, fontWeight: 700, color: OG.rink }}>{row.record}</div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 19, color: OG.board }}>{fmtPts(row.pf)}</div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 19, color: OG.muted }}>{fmtPts(row.pa)}</div>
              <div style={{ display: "flex", width: 120, justifyContent: "center", fontSize: 19, fontWeight: 600, color: diff >= 0 ? "#1F7A4D" : OG.centerRed }}>{fmtDiff(diff)}</div>
              <div style={{ display: "flex", width: 90, justifyContent: "center", fontSize: 18, color: OG.muted }}>{row.streak ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
