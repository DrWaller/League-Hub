import { ImageResponse } from "next/og";
import { Matchup } from "./types";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";

const GREEN_TINT = "#DCEFE4";

export async function renderScoreboard(opts: {
  matchups: Matchup[];
  week: number;
  teamName: (id: number) => string;
  title?: string; // e.g. "Week 4 scoreboard - 2026"
}) {
  const { matchups, week, teamName } = opts;
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);

  const games = matchups.filter((m) => m.homeTeamId != null && m.awayTeamId != null);
  const finals = games.filter((m) => m.isFinal);

  // Footer callouts, from finished games only.
  let highTeam = "";
  let highScore = -1;
  let close: Matchup | null = null;
  for (const m of finals) {
    for (const [id, sc] of [[m.homeTeamId, m.homeScore], [m.awayTeamId, m.awayScore]] as [number, number][]) {
      if (sc > highScore) {
        highScore = sc;
        highTeam = teamName(id);
      }
    }
    if (m.homeScore !== m.awayScore && (!close || Math.abs(m.homeScore - m.awayScore) < Math.abs(close.homeScore - close.awayScore))) close = m;
  }
  const highText = highScore >= 0 ? `High score: ${highTeam} (${highScore.toFixed(1)})` : "";
  const closeText = close
    ? `Closest game: ${teamName(close.homeScore > close.awayScore ? close.homeTeamId : close.awayTeamId)} by ${Math.abs(close.homeScore - close.awayScore).toFixed(1)}`
    : "";

  const ROW_H = 68;
  const height = 132 + 3 + 28 + games.length * ROW_H + 70;

  const name = (id: number, win: boolean, tie: boolean, align: "flex-start" | "flex-end") => (
    <div
      style={{
        display: "flex",
        width: 420,
        justifyContent: align,
        alignItems: "center",
        fontSize: 22,
        fontWeight: win || tie ? 700 : 400,
        color: win || tie ? OG.board : OG.muted,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      {teamName(id)}
    </div>
  );

  const score = (n: number, win: boolean, final: boolean) => (
    <div
      style={{
        display: "flex",
        width: 110,
        justifyContent: "center",
        alignItems: "center",
        height: 44,
        fontFamily: display,
        fontSize: 26,
        fontWeight: 700,
        color: final ? (win ? OG.board : OG.muted) : OG.muted,
        ...(final && win ? { background: GREEN_TINT, borderRadius: 6 } : {}),
      }}
    >
      {n.toFixed(1)}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "32px 48px 28px 48px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, color: OG.ice, textTransform: "uppercase" }}>
            {opts.title ?? `Week ${week} scoreboard`}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#B9C9DC" }}>
            {finals.length === games.length ? "Final scores" : `${finals.length} of ${games.length} games final`}
          </div>
        </div>
        <div style={{ height: 3, background: OG.centerRed }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "28px 48px 0 48px" }}>
          {games.map((m, i) => {
            const tie = m.isFinal && m.homeScore === m.awayScore;
            const homeWin = m.isFinal && m.homeScore > m.awayScore;
            const awayWin = m.isFinal && m.awayScore > m.homeScore;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: ROW_H,
                  gap: 16,
                  background: i % 2 === 0 ? "#FFFFFF" : OG.icePanel,
                }}
              >
                {name(m.homeTeamId, homeWin, tie, "flex-end")}
                {score(m.homeScore, homeWin, m.isFinal)}
                {score(m.awayScore, awayWin, m.isFinal)}
                {name(m.awayTeamId, awayWin, tie, "flex-start")}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 15, fontWeight: 600, color: OG.rink }}>
            <div style={{ display: "flex" }}>{highText}</div>
            <div style={{ display: "flex" }}>{closeText}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height, fonts }
  );
}
