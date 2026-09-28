import { ImageResponse } from "next/og";
import { LuckRow, luckColor, luckExtremes, luckTint } from "./luck";
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
  { key: "diff", label: "Luck", width: 90, align: "flex-end" as const },
  { key: "med", label: "Med pts/wk", width: 100, align: "flex-end" as const },
  { key: "vs", label: "Med vs lg", width: 108, align: "flex-end" as const },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

export async function renderLuckChart(opts: {
  rows: LuckRow[];
  leagueMedian: number;
  week: number;
  teamName: (id: number) => string;
  title?: string; // e.g. "Luck chart - 2025 final"
}) {
  const { rows, leagueMedian, week, teamName } = opts;
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const { luckiest, unluckiest } = luckExtremes(rows);

  const ROW_H = 52;
  const height = 132 + 3 + 24 + 40 + rows.length * ROW_H + 64;

  const table = rows.map((r, i) => {
    const diffPts = Math.round(r.diff * 100);
    const chg = r.rankChange;
    return {
      bg: i % 2 === 0 ? "#FFFFFF" : OG.icePanel,
      cells: [
        { text: chg ? signed(chg) : "-", color: OG.muted, weight: 600 as const, bg: undefined as string | undefined },
        { text: teamName(r.teamId), color: OG.board, weight: 600 as const, bg: undefined },
        { text: record(r.allPlayW, r.allPlayL, r.allPlayT), color: OG.muted, weight: 400 as const, bg: undefined },
        { text: pct(r.expWinPct), color: OG.muted, weight: 400 as const, bg: undefined },
        { text: record(r.actW, r.actL, r.actT), color: OG.board, weight: 400 as const, bg: undefined },
        { text: pct(r.actWinPct), color: OG.board, weight: 400 as const, bg: undefined },
        // The luck cell: green when lucky, red when unlucky, shaded by size.
        { text: `${signed(diffPts)}%`, color: luckColor(r.diff), weight: 600 as const, bg: luckTint(r.diff) },
        { text: r.medPts.toFixed(1), color: OG.muted, weight: 400 as const, bg: undefined },
        { text: signed(r.medVsLeague, 1), color: OG.board, weight: 600 as const, bg: undefined },
      ],
    };
  });

  const luckyText = luckiest ? `Luckiest: ${teamName(luckiest.teamId)} (${signed(Math.round(luckiest.diff * 100))}%)` : "";
  const unluckyText = unluckiest ? `Unluckiest: ${teamName(unluckiest.teamId)} (${signed(Math.round(unluckiest.diff * 100))}%)` : "";

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
            {opts.title ?? "Luck chart"}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>
            {`Through week ${week} - green = lucky, red = unlucky (actual win% vs. what playing everyone every week says)`}
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
            <div key={i} style={{ display: "flex", height: ROW_H, background: row.bg }}>
              {row.cells.map((cell, j) => (
                <div
                  key={j}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: COLS[j].width,
                    justifyContent: COLS[j].align,
                    fontSize: 17,
                    fontWeight: cell.weight,
                    color: cell.color,
                    // The renderer crashes on undefined style values, so the tint is only added when present.
                    ...(cell.bg ? { background: cell.bg, paddingRight: 10 } : {}),
                  }}
                >
                  {cell.text}
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ display: "flex", color: luckColor(1), fontWeight: 600 }}>{luckyText}</div>
              <div style={{ display: "flex", color: luckColor(-1), fontWeight: 600 }}>{unluckyText}</div>
            </div>
            <div style={{ display: "flex", color: OG.muted }}>{`League median = ${leagueMedian.toFixed(1)}`}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
