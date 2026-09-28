import { ImageResponse } from "next/og";
import { LuckRow } from "./luck";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";

// Satori notes: every element with more than one child needs an explicit
// display:flex, fragments (<>) aren't supported, and there's no CSS grid --
// so the "table" is rows of fixed-width flex cells, and every cell's text
// is precomputed into ONE string.

const COLS = [
  { key: "chg", label: "Chg", width: 56, align: "center" as const },
  { key: "team", label: "Team", width: 300, align: "flex-start" as const },
  { key: "allPlay", label: "All-play", width: 120, align: "flex-end" as const },
  { key: "exp", label: "Exp win%", width: 110, align: "flex-end" as const },
  { key: "actual", label: "Actual", width: 110, align: "flex-end" as const },
  { key: "act", label: "Act win%", width: 110, align: "flex-end" as const },
  { key: "diff", label: "Diff", width: 90, align: "flex-end" as const },
  { key: "med", label: "Med pts/wk", width: 100, align: "flex-end" as const },
  { key: "vs", label: "Med vs lg", width: 108, align: "flex-end" as const },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;
const tone = (n: number) => (n > 0 ? OG.rink : n < 0 ? OG.centerRed : OG.muted);

export async function renderLuckChart(opts: {
  rows: LuckRow[];
  leagueMedian: number;
  week: number;
  teamName: (id: number) => string;
}) {
  const { rows, leagueMedian, week, teamName } = opts;
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);

  const ROW_H = 52;
  const height = 132 + 3 + 24 + 40 + rows.length * ROW_H + 60;

  const table = rows.map((r, i) => {
    const diffPts = Math.round(r.diff * 100);
    const chg = r.rankChange;
    return {
      bg: i % 2 === 0 ? "#FFFFFF" : OG.icePanel,
      cells: [
        { text: chg === null ? "-" : chg === 0 ? "-" : signed(chg), color: chg ? tone(chg) : OG.muted, weight: 600 as const },
        { text: teamName(r.teamId), color: OG.board, weight: 600 as const },
        { text: record(r.allPlayW, r.allPlayL, r.allPlayT), color: OG.muted, weight: 400 as const },
        { text: pct(r.expWinPct), color: OG.muted, weight: 400 as const },
        { text: record(r.actW, r.actL, r.actT), color: OG.board, weight: 400 as const },
        { text: pct(r.actWinPct), color: OG.board, weight: 400 as const },
        { text: `${signed(diffPts)}%`, color: tone(diffPts), weight: 600 as const },
        { text: r.medPts.toFixed(1), color: OG.muted, weight: 400 as const },
        { text: signed(r.medVsLeague, 1), color: tone(r.medVsLeague), weight: 600 as const },
      ],
    };
  });

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
            Luck chart
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>
            {`Through week ${week} - expected record if every team played every other team, every week`}
          </div>
        </div>
        <div style={{ height: 3, background: OG.centerRed }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "24px 48px 0 48px" }}>
          <div style={{ display: "flex", borderBottom: `2px solid ${OG.rink}`, height: 40, alignItems: "center" }}>
            {COLS.map((c) => (
              <div key={c.key} style={{ display: "flex", width: c.width, justifyContent: c.align, fontFamily: display, fontSize: 13, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
                {c.label}
              </div>
            ))}
          </div>
          {table.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", height: ROW_H, background: row.bg }}>
              {row.cells.map((cell, j) => (
                <div key={j} style={{ display: "flex", width: COLS[j].width, justifyContent: COLS[j].align, fontSize: 17, fontWeight: cell.weight, color: cell.color }}>
                  {cell.text}
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, fontSize: 14, color: OG.muted }}>
            {`League median = ${leagueMedian.toFixed(1)}`}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
