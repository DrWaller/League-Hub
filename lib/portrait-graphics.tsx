import { ImageResponse } from "next/og";
import { ReactNode } from "react";
import { Team, PowerRankingEntry, Matchup } from "./types";
import { LuckRow, luckColor, luckExtremes, luckTint } from "./luck";
import { OG } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { TeamBadge, TeamLine } from "./og-team-logo";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { PreviewGame, sideLine } from "./preview-image";

// Portrait (1080 x 1350, 4:5) versions of every weekly graphic, for phones and
// social posts. Selected with ?format=portrait on each graphics route.
// Same Satori rules as the landscape ones: every element with more than one
// child needs display:flex, and table cells hold ONE precomputed string.

const W = 1080;
const H = 1350;
const GREEN = "#1F7A4D";
const GREEN_TINT = "#DCEFE4";
const HEADER_H = 203; // header band + red rule (approx.), used to size rows
const BODY_PAD_Y = 76; // top + bottom padding of the body
const BOLD_HEADER_H = 206; // header + red rule of the bold style
const FOOTER_H = 64;

export const isPortrait = (v: string | null | undefined) => (v ?? "").toLowerCase() === "portrait";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

export const seasonFooter = (leagueName: string, season: number) =>
  `${leagueName.toUpperCase()} - ${season - 1}-${String(season).slice(2)} SEASON`;

async function frame(opts: {
  title: string;
  subtitle: string;
  bold?: boolean; // taller header with a big title, plus an optional footer line (Team of the Week, Matchup Preview)
  footer?: string;
  body: (f: { display: string; body: string }) => ReactNode;
}) {
  const fonts = await loadGraphicFonts();
  const fam = getFontFamilies(fonts);
  const { display, body } = fam;
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: OG.ice, fontFamily: body }}>
        {opts.bold ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: BOLD_HEADER_H, padding: "0 56px", background: OG.rink, borderBottom: `6px solid ${OG.centerRed}` }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1 }}>
              {opts.title}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#B9C9DC", marginTop: 14 }}>{opts.subtitle}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", background: OG.rink, padding: "48px 56px 40px 56px" }}>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 64, color: OG.ice, textTransform: "uppercase" }}>
                {opts.title}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#B9C9DC", marginTop: 4 }}>{opts.subtitle}</div>
            </div>
            <div style={{ height: 3, background: OG.centerRed }} />
          </>
        )}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: opts.bold ? "10px 48px 0 48px" : "36px 48px 40px 48px" }}>
          {opts.body({ display, body })}
        </div>
        {opts.bold && opts.footer ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: FOOTER_H, fontFamily: display, fontSize: 22, letterSpacing: 4, color: OG.muted }}>
            {opts.footer}
          </div>
        ) : null}
      </div>
    ),
    { width: W, height: H, fonts }
  );
}

// ---------------------------------------------------------------- power rankings
export async function renderPortraitPowerRankings(opts: {
  rankings: PowerRankingEntry[];
  teams: Team[];
  throughWeek: number;
  logos?: Record<number, string>;
}) {
  const { rankings, teams, throughWeek } = opts;
  const logos = opts.logos ?? {};
  const avail = H - HEADER_H - BODY_PAD_Y - 52 - 44;
  const rowH = Math.min(104, Math.floor(avail / Math.max(1, rankings.length)));

  return frame({
    title: "Power rankings",
    subtitle: throughWeek > 1 ? `Through week ${throughWeek} - movement vs. week ${throughWeek - 1}` : `Through week ${throughWeek}`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 18, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
          <div style={{ display: "flex", width: 70, justifyContent: "center" }}>#</div>
          <div style={{ display: "flex", width: 100, justifyContent: "center" }}>Move</div>
          <div style={{ display: "flex", flexGrow: 1, paddingLeft: 8 }}>Team</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>Record</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>Score</div>
        </div>
        {rankings.map((r, i) => {
          const team = teams.find((t) => t.id === r.teamId);
          const name = team?.name ?? `Team ${r.teamId}`;
          const change = r.previousRank != null ? r.previousRank - r.rank : null;
          const move = change == null ? "" : change === 0 ? "-" : change > 0 ? `▲ ${change}` : `▼ ${Math.abs(change)}`;
          const moveColor = change == null || change === 0 ? OG.muted : change > 0 ? GREEN : OG.centerRed;
          const rec = team ? record(team.wins, team.losses, team.ties) : "";
          return (
            <div key={r.teamId} style={{ display: "flex", alignItems: "center", height: rowH, background: i % 2 === 0 ? "#FFFFFF" : OG.icePanel }}>
              <div style={{ display: "flex", width: 70, justifyContent: "center", fontSize: 32, fontWeight: 700, color: OG.rink }}>{r.rank}</div>
              <div style={{ display: "flex", width: 100, justifyContent: "center", fontSize: 26, fontWeight: 700, color: moveColor }}>{move}</div>
              <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 16, paddingLeft: 8 }}>
                <TeamBadge name={name} logo={logos[r.teamId]} size={60} fontFamily={display} />
                <div style={{ display: "flex", fontSize: 29, fontWeight: 600, color: OG.board, maxWidth: 440, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{name}</div>
              </div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 27, color: OG.muted }}>{rec}</div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 27, fontWeight: 600, color: OG.board }}>{r.score.toFixed(2)}</div>
            </div>
          );
        })}
        <div style={{ display: "flex", marginTop: 16, fontSize: 18, color: OG.muted }}>Blend of win %, point differential and streak - regular season only.</div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- scoreboard
export async function renderPortraitScoreboard(opts: {
  matchups: Matchup[];
  week: number;
  teamName: (id: number) => string;
  title?: string;
  logos?: Record<number, string>;
}) {
  const { week, teamName } = opts;
  const logos = opts.logos ?? {};
  const games = opts.matchups.filter((m) => m.homeTeamId != null && m.awayTeamId != null);
  const finals = games.filter((m) => m.isFinal);

  let highTeam = "", highScore = -1;
  let close: Matchup | null = null;
  for (const m of finals) {
    for (const [id, sc] of [[m.homeTeamId, m.homeScore], [m.awayTeamId, m.awayScore]] as [number, number][]) {
      if (sc > highScore) { highScore = sc; highTeam = teamName(id); }
    }
    if (m.homeScore !== m.awayScore && (!close || Math.abs(m.homeScore - m.awayScore) < Math.abs(close.homeScore - close.awayScore))) close = m;
  }
  const highText = highScore >= 0 ? `High score: ${highTeam} (${highScore.toFixed(1)})` : "";
  const closeText = close
    ? `Closest game: ${teamName(close.homeScore > close.awayScore ? close.homeTeamId : close.awayTeamId)} by ${Math.abs(close.homeScore - close.awayScore).toFixed(1)}`
    : "";

  const GAP = 16;
  const avail = H - HEADER_H - BODY_PAD_Y - 90;
  const cardH = Math.min(210, Math.floor((avail - (games.length - 1) * GAP) / Math.max(1, games.length)));

  return frame({
    title: opts.title ?? `Week ${week} scoreboard`,
    subtitle: finals.length === games.length ? "Final scores" : `${finals.length} of ${games.length} games final`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
        {games.map((m, i) => {
          const tie = m.isFinal && m.homeScore === m.awayScore;
          const side = (id: number, score: number, win: boolean) => (
            <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 16, padding: "0 20px" }}>
              <TeamBadge name={teamName(id)} logo={logos[id]} size={Math.min(64, Math.floor(cardH / 2) - 12)} fontFamily={display} />
              <div style={{ display: "flex", flexGrow: 1, fontSize: 32, fontWeight: win || tie ? 700 : 400, color: win || tie ? OG.board : OG.muted, maxWidth: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {teamName(id)}
              </div>
              <div
                style={{
                  display: "flex", justifyContent: "center", alignItems: "center", width: 150, height: 52,
                  fontFamily: display, fontSize: 38, fontWeight: 700, color: m.isFinal ? (win ? OG.board : OG.muted) : OG.muted,
                  ...(m.isFinal && win ? { background: GREEN_TINT, borderRadius: 6 } : {}),
                }}
              >
                {score.toFixed(1)}
              </div>
            </div>
          );
          const homeWin = m.isFinal && m.homeScore > m.awayScore;
          const awayWin = m.isFinal && m.awayScore > m.homeScore;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: cardH, background: "#FFFFFF", border: `1px solid ${OG.iceLine}`, borderRadius: 10 }}>
              {side(m.homeTeamId, m.homeScore, homeWin)}
              <div style={{ display: "flex", height: 1, background: OG.iceLine, marginLeft: 20, marginRight: 20 }} />
              {side(m.awayTeamId, m.awayScore, awayWin)}
            </div>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 6, fontSize: 22, fontWeight: 600, color: OG.rink }}>
          <div style={{ display: "flex" }}>{highText}</div>
          <div style={{ display: "flex" }}>{closeText}</div>
        </div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- luck chart
export async function renderPortraitLuck(opts: {
  rows: LuckRow[];
  leagueMedian: number;
  week: number;
  teamName: (id: number) => string;
  title?: string;
  logos?: Record<number, string>;
}) {
  const { rows, leagueMedian, week, teamName } = opts;
  const logos = opts.logos ?? {};
  const { luckiest, unluckiest } = luckExtremes(rows);
  const avail = H - HEADER_H - BODY_PAD_Y - 52 - 110;
  const rowH = Math.min(92, Math.floor(avail / Math.max(1, rows.length)));

  return frame({
    title: opts.title ?? "Luck chart",
    subtitle: `Through week ${week} - green = lucky, red = unlucky`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 17, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
          <div style={{ display: "flex", width: 64, justifyContent: "center" }}>Chg</div>
          <div style={{ display: "flex", flexGrow: 1, paddingLeft: 8 }}>Team</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>Actual</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>Exp win%</div>
          <div style={{ display: "flex", width: 140, justifyContent: "center" }}>Luck</div>
        </div>
        {rows.map((r, i) => {
          const name = teamName(r.teamId);
          const chg = r.rankChange;
          const diffPts = Math.round(r.diff * 100);
          return (
            <div key={r.teamId} style={{ display: "flex", alignItems: "center", height: rowH, background: i % 2 === 0 ? "#FFFFFF" : OG.icePanel }}>
              <div style={{ display: "flex", width: 64, justifyContent: "center", fontSize: 24, fontWeight: 600, color: OG.muted }}>{chg ? signed(chg) : "-"}</div>
              <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 14, paddingLeft: 8 }}>
                <TeamBadge name={name} logo={logos[r.teamId]} size={50} fontFamily={display} />
                <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: OG.board, maxWidth: 330, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{name}</div>
              </div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 26, color: OG.board }}>{record(r.actW, r.actL, r.actT)}</div>
              <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 26, color: OG.muted }}>{pct(r.expWinPct)}</div>
              <div style={{ display: "flex", width: 140, height: rowH, alignItems: "center", justifyContent: "center", fontSize: 27, fontWeight: 700, color: luckColor(r.diff), background: luckTint(r.diff) }}>
                {`${signed(diffPts)}%`}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 18, fontSize: 21, fontWeight: 600 }}>
          <div style={{ display: "flex", color: luckColor(1) }}>{luckiest ? `Luckiest: ${teamName(luckiest.teamId)} (${signed(Math.round(luckiest.diff * 100))}%)` : ""}</div>
          <div style={{ display: "flex", color: luckColor(-1) }}>{unluckiest ? `Unluckiest: ${teamName(unluckiest.teamId)} (${signed(Math.round(unluckiest.diff * 100))}%)` : ""}</div>
          <div style={{ display: "flex", color: OG.muted, fontWeight: 400 }}>{`League median = ${leagueMedian.toFixed(1)}`}</div>
        </div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- 3 stars / top 3 (stacked cards)
export interface PortraitPlayer {
  id: number;
  name: string;
  teamName: string;
  teamId: number;
  points: number;
}

export async function renderPortraitPlayerList(opts: {
  title: string;
  subtitle: string;
  players: PortraitPlayer[];
  labels: string[];
  colors: string[];
  emptyMessage: string;
  logos?: Record<number, string>;
  headshots: Set<number>;
}) {
  const logos = opts.logos ?? {};
  return frame({
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 24 }}>
        {opts.players.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex", flex: 1, alignItems: "center", gap: 32, padding: "0 36px",
              background: "#FFFFFF", border: `1px solid ${OG.iceLine}`, borderLeft: `14px solid ${opts.colors[i]}`, borderRadius: 12,
            }}
          >
            <PlayerAvatar
              name={p.name}
              src={headshotUrl(p.id)}
              hasHeadshot={opts.headshots.has(p.id)}
              size={190}
              fontFamily={display}
              fontSize={64}
              border={`5px solid ${opts.colors[i]}`}
            />
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 8 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 22, fontWeight: 700, color: opts.colors[i], letterSpacing: 2 }}>{opts.labels[i]}</div>
              <div style={{ display: "flex", fontFamily: display, fontSize: 46, fontWeight: 700, color: OG.board, lineHeight: 1.1 }}>{p.name}</div>
              <TeamLine name={p.teamName} logo={logos[p.teamId]} size={32} fontSize={26} align="flex-start" />
            </div>
            <div style={{ display: "flex", fontFamily: display, fontSize: 48, fontWeight: 700, color: OG.centerRed }}>{p.points.toFixed(2)}</div>
          </div>
        ))}
        {opts.players.length === 0 && <div style={{ display: "flex", color: OG.muted, fontSize: 28 }}>{opts.emptyMessage}</div>}
      </div>
    ),
  });
}

// ---------------------------------------------------------------- team of the week (grouped by position)
export async function renderPortraitTeamOfWeek(opts: {
  subtitle: string;
  footer?: string;
  lineup: { slot: string; player?: PortraitPlayer }[];
  logos?: Record<number, string>;
  headshots: Set<number>;
}) {
  const logos = opts.logos ?? {};
  const scored = opts.lineup.map((l) => l.player?.points).filter((p): p is number => p !== undefined);
  const high = scored.length ? Math.max(...scored) : null;

  const forwardOrder = ["LW", "C", "RW"];
  const forwards = forwardOrder
    .map((pos) => opts.lineup.find((l) => l.slot === pos))
    .filter((l): l is { slot: string; player?: PortraitPlayer } => Boolean(l));
  const defence = opts.lineup.filter((l) => l.slot === "D");
  const goalie = opts.lineup.filter((l) => l.slot === "G");
  const known = new Set([...forwards, ...defence, ...goalie]);
  const other = opts.lineup.filter((l) => !known.has(l)); // any slot we don't recognise still shows

  const CARD_W = 314;

  return frame({
    title: "Team of the Week",
    subtitle: opts.subtitle,
    bold: true,
    footer: opts.footer,
    body: ({ display }) => {
      const card = (l: { slot: string; player?: PortraitPlayer }, i: number) => {
        const p = l.player;
        const isHigh = p != null && high != null && p.points === high;
        return (
          <div
            key={`${l.slot}-${i}`}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", position: "relative",
              width: CARD_W, padding: "40px 12px 14px 12px",
              background: "#FFFFFF", border: `${isHigh ? 4 : 2}px solid ${isHigh ? OG.gold : OG.iceLine}`, borderRadius: 20,
            }}
          >
            <div
              style={{
                position: "absolute", top: 12, left: 12, display: "flex", padding: "2px 14px", borderRadius: 8,
                background: isHigh ? OG.gold : OG.rink, color: isHigh ? OG.board : "#FFFFFF",
                fontFamily: display, fontWeight: 700, fontSize: 22,
              }}
            >
              {isHigh ? `${l.slot} - WEEK HIGH` : l.slot}
            </div>
            {p ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                <PlayerAvatar name={p.name} src={headshotUrl(p.id)} hasHeadshot={opts.headshots.has(p.id)} size={96} fontFamily={display} fontSize={32} border={`5px solid ${isHigh ? OG.gold : OG.muted}`} />
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, lineHeight: 1.1, marginTop: 10, maxWidth: CARD_W - 24, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, maxWidth: CARD_W - 24, fontSize: 21, color: OG.muted }}>
                  {logos[p.teamId] ? <TeamBadge name={p.teamName} logo={logos[p.teamId]} size={22} fontFamily={display} /> : null}
                  <div style={{ display: "flex", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: logos[p.teamId] ? CARD_W - 70 : CARD_W - 24 }}>{p.teamName}</div>
                </div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 44, color: OG.centerRed, marginTop: 4 }}>{p.points.toFixed(2)}</div>
              </div>
            ) : (
              <div style={{ display: "flex", color: OG.muted, fontSize: 24, height: 150, alignItems: "center" }}>No data</div>
            )}
          </div>
        );
      };
      const label = (text: string) => (
        <div style={{ display: "flex", fontFamily: display, fontSize: 22, letterSpacing: 5, color: OG.muted, margin: "10px 4px 6px 4px" }}>{text}</div>
      );
      const group = (text: string, items: { slot: string; player?: PortraitPlayer }[]) =>
        items.length === 0 ? null : (
          <div key={text} style={{ display: "flex", flexDirection: "column" }}>
            {label(text)}
            <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>{items.map(card)}</div>
          </div>
        );
      return (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {group("FORWARDS", forwards)}
          {group("DEFENCE", defence)}
          {group("GOALIE", goalie)}
          {group("OTHER", other)}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------- player spotlight
export async function renderPortraitSpotlight(opts: {
  subtitle: string;
  positionName: string;
  player: PortraitPlayer;
  tiles: { label: string; value: string }[];
  logos?: Record<number, string>;
  hasHeadshot: boolean;
}) {
  const logos = opts.logos ?? {};
  const p = opts.player;
  return frame({
    title: "Player Spotlight",
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", padding: "56px 40px",
            background: "#FFFFFF", borderTop: `10px solid ${OG.gold}`, borderLeft: `1px solid ${OG.iceLine}`, borderRight: `1px solid ${OG.iceLine}`, borderBottom: `1px solid ${OG.iceLine}`, borderRadius: 14,
          }}
        >
          <PlayerAvatar name={p.name} src={headshotUrl(p.id)} hasHeadshot={opts.hasHeadshot} size={330} fontFamily={display} fontSize={112} border={`8px solid ${OG.gold}`} />
          <div style={{ display: "flex", fontFamily: display, fontSize: 24, fontWeight: 700, color: OG.gold, letterSpacing: 3, marginTop: 10 }}>{opts.positionName.toUpperCase()}</div>
          <div style={{ display: "flex", fontFamily: display, fontSize: 70, fontWeight: 700, color: OG.board, lineHeight: 1.1, textAlign: "center" }}>{p.name}</div>
          <TeamLine name={p.teamName} logo={logos[p.teamId]} size={40} fontSize={30} />
          <div style={{ display: "flex", fontFamily: display, fontSize: 84, fontWeight: 700, color: OG.centerRed, marginTop: 6 }}>{p.points.toFixed(2)} pts</div>
          {opts.tiles.length > 0 && (
            <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
              {opts.tiles.map((t) => (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 190, background: OG.icePanel, border: `1px solid ${OG.iceLine}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 56, fontWeight: 700, color: OG.rink }}>{t.value}</div>
                  <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: OG.muted, letterSpacing: 1 }}>{t.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- matchup preview
export async function renderPortraitPreview(opts: { games: PreviewGame[]; week: number; footer?: string; logos?: Record<number, string> }) {
  const logos = opts.logos ?? {};
  const n = Math.max(1, opts.games.length);
  const GAP = 14;
  const DIV = 30;
  const avail = H - BOLD_HEADER_H - FOOTER_H - 20 - 12; // header, footer, body top padding, slack
  const cardH = Math.min(190, Math.floor((avail - (n - 1) * GAP) / n));
  const rowH = Math.floor((cardH - DIV) / 2);
  const rankSize = Math.min(52, rowH - 10);
  const logoSize = Math.min(52, rowH - 10);
  const nameSize = rowH >= 70 ? 30 : rowH >= 58 ? 28 : 26;

  return frame({
    title: `Week ${opts.week} matchups`,
    subtitle: "Power rank and record going in",
    bold: true,
    footer: opts.footer,
    body: ({ display }) => {
      const row = (s: PreviewGame["home"]) => (
        <div style={{ display: "flex", alignItems: "center", height: rowH, padding: "0 28px", gap: 18 }}>
          {s.rank ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: rankSize, height: rankSize, borderRadius: 10, background: OG.rink, color: "#FFFFFF", fontFamily: display, fontWeight: 700, fontSize: Math.round(rankSize * 0.54) }}>
              {s.rank}
            </div>
          ) : null}
          <TeamBadge name={s.name} logo={logos[s.teamId]} size={logoSize} fontFamily={display} />
          <div style={{ display: "flex", flexGrow: 1, fontSize: nameSize, fontWeight: 600, lineHeight: 1.15, maxWidth: 560, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.name}</div>
          <div style={{ display: "flex", marginLeft: "auto", fontFamily: display, fontWeight: 700, fontSize: 36, color: OG.rink }}>{s.record}</div>
        </div>
      );
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
          {opts.games.map((g, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: cardH, background: "#FFFFFF", border: `2px solid ${OG.iceLine}`, borderRadius: 20 }}>
              {row(g.home)}
              <div style={{ display: "flex", alignItems: "center", height: DIV, padding: "0 28px" }}>
                <div style={{ display: "flex", flex: 1, height: 2, background: OG.iceLine }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 28, margin: "0 16px", padding: "0 20px", borderRadius: 14, background: OG.centerRed, color: "#FFFFFF", fontFamily: display, fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>VS</div>
                <div style={{ display: "flex", flex: 1, height: 2, background: OG.iceLine }} />
              </div>
              {row(g.away)}
            </div>
          ))}
        </div>
      );
    },
  });
}
