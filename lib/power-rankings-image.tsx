import { ImageResponse } from "next/og";
import { Team, PowerRankingEntry } from "./types";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { TeamBadge } from "./og-team-logo";

// Satori notes (same as the luck chart): every element with more than one
// child needs display:flex, and each table cell's text is precomputed into
// ONE string.

const COLS = [
  { key: "rank", label: "#", width: 70, align: "center" as const },
  { key: "move", label: "Move", width: 100, align: "center" as const },
  { key: "team", label: "Team", width: 520, align: "flex-start" as const },
  { key: "rec", label: "Record", width: 130, align: "flex-end" as const },
  { key: "streak", label: "Streak", width: 110, align: "flex-end" as const },
  { key: "score", label: "Score", width: 120, align: "flex-end" as const },
];

const GREEN = "#1F7A4D";

export async function renderPowerRankings(opts: {
  rankings: PowerRankingEntry[];
  teams: Team[];
  throughWeek: number;
  logos?: Record<number, string>;
}) {
  const { rankings, teams, throughWeek } = opts;
  const logos = opts.logos ?? {};
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);

  const ROW_H = 60;
  const height = 132 + 3 + 24 + 40 + rankings.length * ROW_H + 56;

  const rows = rankings.map((r, i) => {
    const team = teams.find((t) => t.id === r.teamId);
    const change = r.previousRank != null ? r.previousRank - r.rank : null;
    const move =
      change == null ? "" : change === 0 ? "-" : change > 0 ? `▲ ${change}` : `▼ ${Math.abs(change)}`;
    const moveColor = change == null || change === 0 ? OG.muted : change > 0 ? GREEN : OG.centerRed;
    const rec = team ? `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}` : "";
    return {
      teamId: r.teamId,
      bg: i % 2 === 0 ? "#FFFFFF" : OG.icePanel,
      cells: [
        { text: String(r.rank), color: OG.rink, weight: 700 as const },
        { text: move, color: moveColor, weight: 700 as const },
        { text: team?.name ?? `Team ${r.teamId}`, color: OG.board, weight: 600 as const },
        { text: rec, color: OG.muted, weight: 400 as const },
        { text: team?.streak ?? "-", color: OG.muted, weight: 400 as const },
        { text: r.score.toFixed(2), color: OG.board, weight: 600 as const },
      ],
    };
  });

  const subtitle =
    throughWeek > 1
      ? `Through week ${throughWeek} - movement vs. week ${throughWeek - 1}`
      : `Through week ${throughWeek}`;

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
            Power rankings
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>{subtitle}</div>
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
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", height: ROW_H, background: row.bg }}>
              {row.cells.map((cell, j) => (
                <div
                  key={j}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: COLS[j].width,
                    justifyContent: COLS[j].align,
                    fontSize: j === 0 ? 22 : 20,
                    fontWeight: cell.weight,
                    color: cell.color,
                    
                  }}
                >
                  {j === 2 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <TeamBadge name={cell.text} logo={logos[row.teamId]} size={38} fontFamily={display} />
                      <div style={{ display: "flex" }}>{cell.text}</div>
                    </div>
                  ) : (
                    cell.text
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", marginTop: 14, fontSize: 14, color: OG.muted }}>
            Blend of win %, point differential and streak - regular season only.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
