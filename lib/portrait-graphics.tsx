import { ImageResponse } from "next/og";
import { ReactNode, CSSProperties } from "react";
import { Team, PowerRankingEntry, Matchup } from "./types";
import { LuckRow, luckColor, luckExtremes, luckTint } from "./luck";
import { OG, NO_CACHE, TEAM_COLOR } from "./og-theme";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { TeamBadge, TeamLine } from "./og-team-logo";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { getLeagueMeta } from "./espn";
import { getWeekCalendar } from "./week-calendar";
import { dateRanges } from "./week-calendar-utils";
import { PreviewGame, sideLine } from "./preview-image";
import { StandingsRow, fmtPts } from "./standings-image";

// Portrait (1080 x 1350, 4:5) versions of every weekly graphic, for phones and
// social posts. Selected with ?format=portrait on each graphics route.
// Same Satori rules as the landscape ones: every element with more than one
// child needs display:flex, and table cells hold ONE precomputed string.

const W = 1080;
const H = 1350;
const GREEN = "#1F7A4D";
const GREEN_TINT = "#DCEFE4";
const BOLD_HEADER_H = 192; // header band + red rule
const FOOTER_H = 64;

// One set of numbers every card shares, so the weekly package stays consistent.
const CARD_RADIUS = 18;
const CARD_BORDER = "1px solid #BCD5EA";
const CARD_SHADOW = "0 6px 16px rgba(18,58,97,0.10)";
const AVATAR_BORDER = 6; // portrait ring thickness
const AVATAR_LIST = 216; // portrait circle in the Top 3 / runner-up cards
const AVATAR_LIST_FIRST = 256; // ...and in the #1 card
const LOGO_SIZE = 44; // team logo next to a team name under a player
const TOTW_LOGO = 30; // same, inside the smaller Team of the Week cards
const PTS_GAP = 14; // space between a points number and "PTS"
const RINK_LINE = "rgba(196,30,58,0.08)"; // rink markings: noticed on the second look
const RINK_DOT = "rgba(18,58,97,0.055)";

// Thin team-colour strip along the bottom edge of a player card. Teams with no colour in
// lib/og-theme.ts (TEAM_COLOR) just get no strip. The card must be position:relative + overflow:hidden.
function TeamAccent({ teamId }: { teamId: number }) {
  const c = TEAM_COLOR[teamId];
  if (!c) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: c, display: "flex" }} />;
}

// Satori has no star glyph in the loaded fonts, so draw one.
function GoldStar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <polygon points="12,1.5 15,8.6 22.5,9.2 16.8,14.1 18.6,21.5 12,17.6 5.4,21.5 7.2,14.1 1.5,9.2 9,8.6" fill={OG.gold} />
    </svg>
  );
}
const CHROME = BOLD_HEADER_H + FOOTER_H + 40; // header + footer + body padding: what rows can't use

// Portrait is the primary shape: only an explicit ?format=landscape gives the wide version.
export const isPortrait = (v: string | null | undefined) => (v ?? "").toLowerCase() !== "landscape";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const record = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

export const seasonFooter = (leagueName: string, season: number) =>
  `${leagueName.toUpperCase()} \u00b7 ${season - 1}\u2013${String(season).slice(2)} SEASON`;

// Pulls "Week N" out of the title/subtitle so the header can show a big week
// badge and that week's dates (from the saved Week Days calendar). Past seasons
// (a year in the text) and weeks with no saved calendar just skip the dates.
async function headerExtras(title: string, subtitle: string): Promise<{ week: number | null; dates: string }> {
  const text = `${title} ${subtitle}`;
  const m = text.match(/week\s+(\d+)/i);
  if (!m || /20\d\d/.test(text)) return { week: null, dates: "" };
  const week = Number(m[1]);
  let dates = "";
  try {
    const meta = await getLeagueMeta();
    const cal = await getWeekCalendar(meta.season);
    const range = cal ? dateRanges(cal.startDate, cal.lengths)[week - 1] : "";
    if (range) dates = range.replace(/[A-Z][a-z]{2}, /g, "").toUpperCase();
  } catch {
    /* dates are a nice-to-have */
  }
  return { week, dates };
}

export async function frame(opts: {
  title: string;
  subtitle: string;
  footer?: string;
  bold?: boolean; // kept for compatibility; every portrait graphic now uses this one style
  flush?: boolean; // body runs edge to edge (no side/top padding): Player Spotlight
  plain?: boolean; // no rink markings behind the content (Player Radar draws its own chart)
  headerContent?: (f: { display: string; body: string }) => ReactNode; // replaces the title/subtitle/week badge (player cards put the player here)
  body: (f: { display: string; body: string }) => ReactNode;
}) {
  const fonts = await loadGraphicFonts();
  const fam = getFontFamilies(fonts);
  const { display, body } = fam;
  // Past-season graphics arrive titled like "Week 1 scoreboard - 2026": too long for the
  // header, so the year moves into the subtitle line.
  const yearSplit = opts.title.match(/^(.*?)\s*-\s*(20\d\d\b.*)$/);
  const headTitle = yearSplit ? yearSplit[1] : opts.title;
  const headSubtitle = yearSplit ? `${yearSplit[2]} - ${opts.subtitle}` : opts.subtitle;
  const { week, dates } = await headerExtras(headTitle, headSubtitle);
  const titleHasWeek = /week\s+\d+/i.test(headTitle);
  const showBadge = week != null && !titleHasWeek;
  // Shrink long titles so they stay on one line (the badge takes ~210px when shown).
  const headerStyle: CSSProperties = { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", flexShrink: 0, width: W, height: BOLD_HEADER_H, padding: "0 64px", background: OG.rink, borderBottom: `6px solid ${OG.centerRed}` };
  const titleRoom = 952 - (showBadge ? 190 : 0);
  const titleSize = Math.max(52, Math.min(showBadge ? 76 : 84, Math.floor(titleRoom / (headTitle.length * 0.52))));
  // A plain "Week N" subtitle just repeats the badge: show the week's dates there
  // instead (or nothing when no dates are saved).
  const subtitleIsPlainWeek = showBadge && /^week\s+\d+$/i.test(headSubtitle.trim());
  const subtitleText = subtitleIsPlainWeek ? dates : headSubtitle;
  const badgeDates = subtitleIsPlainWeek ? "" : dates;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", backgroundImage: "linear-gradient(180deg, #F8FCFF 0%, #E3EFF9 55%, #D3E5F4 100%)", fontFamily: body }}>
        {/* faint rink markings behind the content: faceoff circle, center dot, center line */}
        {opts.plain ? null : <div style={{ position: "absolute", left: 130, top: 470, width: 820, height: 820, borderRadius: 410, border: `8px solid ${RINK_LINE}`, display: "flex" }} />}
        {opts.plain ? null : <div style={{ position: "absolute", left: 0, top: 876, width: 1080, height: 8, background: RINK_LINE, display: "flex" }} />}
        {opts.plain ? null : <div style={{ position: "absolute", left: 490, top: 850, width: 100, height: 100, borderRadius: 50, background: RINK_DOT, display: "flex" }} />}
        {/* Explicit width + alignSelf + flexShrink: without them the header can collapse to the
            title's width inside a flex column when rendered on the server. */}
        {opts.headerContent ? (
          <div style={headerStyle}>{opts.headerContent({ display, body })}</div>
        ) : (
        <div style={headerStyle}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: titleSize, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
              {headTitle}
            </div>
            {subtitleText ? <div style={{ display: "flex", fontSize: 28, color: "#C9D6E6", marginTop: 14, letterSpacing: subtitleIsPlainWeek ? 2 : 0 }}>{subtitleText}</div> : null}
          </div>
          {showBadge ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "6px 20px 8px 20px", border: `3px solid ${OG.gold}`, borderRadius: 16 }}>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 4, color: "#C9D6E6" }}>WEEK</div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 80, lineHeight: 1, color: OG.gold }}>{week}</div>
              {badgeDates ? <div style={{ display: "flex", fontFamily: display, fontSize: 20, letterSpacing: 1, color: "#C9D6E6", marginTop: 4 }}>{badgeDates}</div> : null}
            </div>
          ) : dates ? (
            <div style={{ display: "flex", flexShrink: 0, fontFamily: display, fontWeight: 700, fontSize: 28, letterSpacing: 2, color: OG.gold }}>{dates}</div>
          ) : null}
        </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: opts.flush ? 0 : "24px 48px 16px 48px" }}>
          {opts.body({ display, body })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", alignSelf: "stretch", flexShrink: 0, height: FOOTER_H, fontFamily: display, fontSize: 26, letterSpacing: 2, color: OG.muted }}>
          {opts.footer ?? ""}
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}

// ---------------------------------------------------------------- power rankings
export async function renderPortraitPowerRankings(opts: {
  footer?: string;
  rankings: PowerRankingEntry[];
  teams: Team[];
  throughWeek: number;
  logos?: Record<number, string>;
}) {
  const { rankings, teams, throughWeek } = opts;
  const logos = opts.logos ?? {};
  const avail = H - CHROME - 52 - 44;
  const rowH = Math.min(104, Math.floor(avail / Math.max(1, rankings.length)));

  return frame({
    footer: opts.footer,
    title: "Power rankings",
    subtitle: throughWeek > 1 ? `Through week ${throughWeek} - movement vs. week ${throughWeek - 1}` : `Through week ${throughWeek}`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 22, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
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
        <div style={{ display: "flex", marginTop: 16, fontSize: 22, color: OG.muted }}>Blend of win %, point differential and streak - regular season only.</div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- scoreboard
export async function renderPortraitScoreboard(opts: {
  footer?: string;
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
  const highText = highScore >= 0 ? `High score: ${highTeam} (${highScore.toFixed(2)})` : "";
  const closeText = close
    ? `Closest game: ${teamName(close.homeScore > close.awayScore ? close.homeTeamId : close.awayTeamId)} by ${Math.abs(close.homeScore - close.awayScore).toFixed(2)}`
    : "";

  const GAP = 16;
  const avail = H - CHROME - 90;
  const cardH = Math.min(210, Math.floor((avail - (games.length - 1) * GAP) / Math.max(1, games.length)));

  return frame({
    footer: opts.footer,
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
                {score.toFixed(2)}
              </div>
            </div>
          );
          const homeWin = m.isFinal && m.homeScore > m.awayScore;
          const awayWin = m.isFinal && m.awayScore > m.homeScore;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: cardH, background: "#FFFFFF", boxShadow: CARD_SHADOW, border: CARD_BORDER, borderRadius: CARD_RADIUS }}>
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
  footer?: string;
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
  const avail = H - CHROME - 52 - 110;
  const rowH = Math.min(92, Math.floor(avail / Math.max(1, rows.length)));

  return frame({
    footer: opts.footer,
    title: opts.title ?? "Luck chart",
    subtitle: `Through week ${week} - green = lucky, red = unlucky`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 21, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 18, fontSize: 24, fontWeight: 600 }}>
          <div style={{ display: "flex", color: luckColor(1) }}>{luckiest ? `Luckiest: ${teamName(luckiest.teamId)} (${signed(Math.round(luckiest.diff * 100))}%)` : ""}</div>
          <div style={{ display: "flex", color: luckColor(-1) }}>{unluckiest ? `Unluckiest: ${teamName(unluckiest.teamId)} (${signed(Math.round(unluckiest.diff * 100))}%)` : ""}</div>
          <div style={{ display: "flex", color: OG.muted, fontWeight: 400 }}>{`League median = ${leagueMedian.toFixed(2)}`}</div>
        </div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- 3 stars / top 3 (stacked cards)
const medalText = (c: string) => (c === OG.gold ? OG.goldText : c === OG.silver ? OG.silverText : c === OG.bronze ? OG.bronzeText : c);

export interface PortraitPlayer {
  id: number;
  name: string;
  teamName: string;
  teamId: number;
  points: number;
  statLine?: string | null; // e.g. "4 G \u00b7 4 A \u00b7 10 SOG"
}

export async function renderPortraitPlayerList(opts: {
  footer?: string;
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
    footer: opts.footer,
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 22 }}>
        {opts.players.map((p, i) => {
          const first = i === 0;
          // "1ST STAR" -> caption "STAR"; "1ST" (top 3 lists) -> no caption
          const caption = (opts.labels[i] ?? "").replace(/^\d+\s*(ST|ND|RD|TH)\s*/i, "");
          return (
            <div
              key={p.id}
              style={{
                display: "flex", position: "relative", overflow: "hidden", flex: first ? 1.25 : 1, alignItems: "center", gap: 20, padding: "0 32px",
                background: first ? "#F1F8FF" : "#FFFFFF",
                border: first ? `4px solid ${OG.gold}` : CARD_BORDER,
                borderRadius: CARD_RADIUS,
                boxShadow: CARD_SHADOW,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96, flexShrink: 0 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: first ? 150 : 116, lineHeight: 1, color: medalText(opts.colors[i]) }}>{i + 1}</div>
                {caption ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: medalText(opts.colors[i]) }}>{caption}</div> : null}
              </div>
              <PlayerAvatar
                name={p.name}
                src={headshotUrl(p.id)}
                hasHeadshot={opts.headshots.has(p.id)}
                size={first ? AVATAR_LIST_FIRST : AVATAR_LIST}
                fontFamily={display}
                fontSize={first ? 86 : 72}
                border={`${AVATAR_BORDER}px solid ${opts.colors[i]}`}
              />
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 6, minWidth: 0 }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: first ? 52 : 46, fontWeight: 700, color: OG.board, lineHeight: 1.1, maxWidth: first ? 500 : 540, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: PTS_GAP }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: first ? 72 : 62, fontWeight: 700, lineHeight: 1, color: OG.centerRed }}>{p.points.toFixed(2)}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: 2, color: OG.muted, marginBottom: 6 }}>PTS</div>
                </div>
                {p.statLine ? <div style={{ display: "flex", fontSize: 27, fontWeight: 600, letterSpacing: 1, color: OG.rink }}>{p.statLine}</div> : null}
                <TeamLine name={p.teamName} logo={logos[p.teamId]} size={LOGO_SIZE} fontSize={24} align="flex-start" />
              </div>
              <TeamAccent teamId={p.teamId} />
            </div>
          );
        })}
        {opts.players.length === 0 && <div style={{ display: "flex", color: OG.muted, fontSize: 28 }}>{opts.emptyMessage}</div>}
      </div>
    ),
  });
}

// ---------------------------------------------------------------- 3 stars (one big first star, two smaller beneath)
// Deliberately NOT a leaderboard: the 1st Star is the feature, the 2nd and 3rd sit side by side
// under it, like the NHL's three-stars presentation.
export async function renderPortraitThreeStars(opts: {
  footer?: string;
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
  const [star1, ...rest] = opts.players;
  const runnersUp = rest.slice(0, 2);

  return frame({
    footer: opts.footer,
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 22 }}>
        {star1 ? (
          <div
            style={{
              display: "flex", position: "relative", overflow: "hidden", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1.45, gap: 6, padding: "10px 0 8px 0",
              background: "#F1F8FF", border: `4px solid ${OG.gold}`, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: display, fontWeight: 700, fontSize: 32, letterSpacing: 6, color: OG.goldText }}>
              <GoldStar size={30} />
              <div style={{ display: "flex" }}>{(opts.labels[0] ?? "1ST STAR").toUpperCase()}</div>
              <GoldStar size={30} />
            </div>
            <PlayerAvatar name={star1.name} src={headshotUrl(star1.id)} hasHeadshot={opts.headshots.has(star1.id)} size={260} fontFamily={display} fontSize={90} border={`${AVATAR_BORDER + 2}px solid ${OG.gold}`} />
            <div style={{ display: "flex", fontFamily: display, fontSize: 62, fontWeight: 700, color: OG.board, lineHeight: 1.1, maxWidth: 900, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{star1.name}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: PTS_GAP }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 88, fontWeight: 700, lineHeight: 1, color: OG.centerRed }}>{star1.points.toFixed(2)}</div>
              <div style={{ display: "flex", fontFamily: display, fontSize: 30, fontWeight: 700, letterSpacing: 2, color: OG.muted, marginBottom: 8 }}>PTS</div>
            </div>
            {star1.statLine ? <div style={{ display: "flex", fontSize: 28, fontWeight: 600, letterSpacing: 1, color: OG.rink }}>{star1.statLine}</div> : null}
            <TeamLine name={star1.teamName} logo={logos[star1.teamId]} size={LOGO_SIZE} fontSize={24} />
            <TeamAccent teamId={star1.teamId} />
          </div>
        ) : null}
        {runnersUp.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "row", flex: 1, gap: 22 }}>
            {runnersUp.map((p, k) => {
              const i = k + 1;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex", position: "relative", overflow: "hidden", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 4, paddingBottom: 8,
                    background: "#FFFFFF", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW,
                  }}
                >
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: medalText(opts.colors[i]) }}>{(opts.labels[i] ?? "").toUpperCase()}</div>
                  <PlayerAvatar name={p.name} src={headshotUrl(p.id)} hasHeadshot={opts.headshots.has(p.id)} size={170} fontFamily={display} fontSize={58} border={`${AVATAR_BORDER}px solid ${opts.colors[i]}`} />
                  <div style={{ display: "flex", fontFamily: display, fontSize: 40, fontWeight: 700, color: OG.board, lineHeight: 1.1, maxWidth: 430, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: PTS_GAP }}>
                    <div style={{ display: "flex", fontFamily: display, fontSize: 58, fontWeight: 700, lineHeight: 1, color: OG.centerRed }}>{p.points.toFixed(2)}</div>
                    <div style={{ display: "flex", fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: 2, color: OG.muted, marginBottom: 5 }}>PTS</div>
                  </div>
                  {p.statLine ? <div style={{ display: "flex", fontSize: 23, fontWeight: 600, letterSpacing: 0.5, color: OG.rink, maxWidth: 430, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.statLine}</div> : null}
                  <TeamLine name={p.teamName} logo={logos[p.teamId]} size={LOGO_SIZE - 8} fontSize={21} />
                  <TeamAccent teamId={p.teamId} />
                </div>
              );
            })}
          </div>
        ) : null}
        {opts.players.length === 0 && <div style={{ display: "flex", color: OG.muted, fontSize: 28 }}>{opts.emptyMessage}</div>}
      </div>
    ),
  });
}

// ---------------------------------------------------------------- team of the week (forwards / defence / goalie rows)
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

  type Slot = { slot: string; player?: PortraitPlayer };
  const forwards = ["LW", "C", "RW"].map((pos) => opts.lineup.find((l) => l.slot === pos)).filter((l): l is Slot => Boolean(l));
  const defence = opts.lineup.filter((l) => l.slot === "D");
  const goalie = opts.lineup.filter((l) => l.slot === "G");
  const known = new Set([...forwards, ...defence, ...goalie]);
  const other = opts.lineup.filter((l) => !known.has(l)); // any slot we don't recognise still shows

  const CARD_W = 314;
  const HIGH_W = 330; // the Week High card is ~5% bigger than the rest

  return frame({
    title: "Team of the Week",
    subtitle: opts.subtitle,
    bold: true,
    footer: opts.footer,
    body: ({ display }) => {
      const card = (l: Slot, i: number) => {
        const p = l.player;
        const isHigh = p != null && high != null && p.points === high;
        const w = isHigh ? HIGH_W : CARD_W;
        const logoShown = p ? Boolean(logos[p.teamId]) : false;
        return (
          <div
            key={`${l.slot}-${i}`}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden",
              width: w, padding: "50px 12px 18px 12px",
              background: "#FFFFFF", boxShadow: CARD_SHADOW, border: `${isHigh ? 4 : 3}px solid ${isHigh ? OG.gold : OG.iceLine}`, borderRadius: CARD_RADIUS,
            }}
          >
            {/* position tag top-left (gold on the Week High card, navy on the rest), week-high marker top-right: both clear of the photo */}
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", padding: "2px 14px", borderRadius: 8, background: isHigh ? OG.gold : OG.rink, color: isHigh ? OG.rinkDeep : "#FFFFFF", fontFamily: display, fontWeight: 700, fontSize: 22 }}>
              {l.slot}
            </div>
            {isHigh ? (
              <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 6, fontFamily: display, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: OG.goldText }}>
                <GoldStar size={22} />
                <div style={{ display: "flex" }}>WEEK HIGH</div>
              </div>
            ) : null}
            {p ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                <PlayerAvatar name={p.name} src={headshotUrl(p.id)} hasHeadshot={opts.headshots.has(p.id)} size={isHigh ? 124 : 118} fontFamily={display} fontSize={36} border={`${isHigh ? 6 : 5}px solid ${isHigh ? OG.gold : OG.rink}`} />
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, lineHeight: 1.1, marginTop: 10, maxWidth: w - 24, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, minHeight: 34, maxWidth: w - 24, fontSize: p.teamName.length > 27 ? 18 : p.teamName.length > 22 ? 20 : 22, color: OG.muted }}>
                  {logoShown ? <TeamBadge name={p.teamName} logo={logos[p.teamId]} size={TOTW_LOGO} fontFamily={display} /> : null}
                  <div style={{ display: "flex", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: logoShown ? w - 24 - TOTW_LOGO - 8 : w - 24 }}>{p.teamName}</div>
                </div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 46, lineHeight: 1, color: OG.centerRed, marginTop: 8 }}>{p.points.toFixed(2)}</div>
              </div>
            ) : (
              <div style={{ display: "flex", color: OG.muted, fontSize: 24, height: 150, alignItems: "center" }}>No data</div>
            )}
            {p ? <TeamAccent teamId={p.teamId} /> : null}
          </div>
        );
      };
      const row = (items: Slot[], key: string) =>
        items.length === 0 ? null : (
          <div key={key} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
            {items.map(card)}
          </div>
        );
      // Rows sit close together in the middle (instead of spreading to the edges) so the
      // goalie reads as part of the formation, not a separate island.
      return (
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: 34 }}>
          {row(forwards, "f")}
          {row(defence, "d")}
          {row(goalie, "g")}
          {row(other, "o")}
        </div>
      );
    },
  });
}

// ---------------------------------------------------------------- player spotlight
export async function renderPortraitSpotlight(opts: {
  footer?: string;
  subtitle: string;
  positionName: string;
  player: PortraitPlayer;
  tiles: { label: string; value: string }[];
  logos?: Record<number, string>;
  hasHeadshot: boolean;
}) {
  const logos = opts.logos ?? {};
  const p = opts.player;
  const logo = logos[p.teamId];
  const teamColor = TEAM_COLOR[p.teamId];
  const parts = p.name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  const longest = Math.max(first.length, last.length);
  const nameSize = Math.max(44, Math.min(96, Math.floor(416 / (Math.max(longest, 1) * 0.5))));

  // Layout numbers (body area is 1080 wide, ~1094 tall; this graphic runs edge to edge).
  const HERO_H = 1000;
  const PANEL_W = 590; // navy photo panel
  const PHOTO_H = 780; // photo sits on the bottom of the panel
  const TILE_H = 160;

  return frame({
    footer: opts.footer,
    title: "Player Spotlight",
    subtitle: opts.subtitle,
    flush: true,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, position: "relative" }}>
        <div style={{ display: "flex", position: "relative", width: 1080, height: HERO_H, overflow: "hidden" }}>
          {/* faint team logo behind the name */}
          {logo ? (
            <div style={{ display: "flex", position: "absolute", left: 560, top: 150, width: 560, height: 560, alignItems: "center", justifyContent: "center", opacity: 0.08 }}>
              <img src={logo} width={560} height={560} style={{ objectFit: "contain" }} />
            </div>
          ) : null}

          {/* navy photo panel with a soft spotlight behind the head */}
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: PANEL_W, height: HERO_H, backgroundImage: "radial-gradient(circle at 50% 38%, #24679F 0%, #123A61 55%, #0C2740 100%)" }} />
          {logo ? (
            <div style={{ display: "flex", position: "absolute", left: 95, top: 40, width: 400, height: 400, alignItems: "center", justifyContent: "center", opacity: 0.16 }}>
              <img src={logo} width={400} height={400} style={{ objectFit: "contain" }} />
            </div>
          ) : null}
          {/* restrained diagonal shapes behind the player: a wide lighter-navy band and one thin gold rule */}
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: PANEL_W - 8, height: HERO_H, overflow: "hidden" }}>
            <div style={{ display: "flex", position: "absolute", left: -120, top: 330, width: PANEL_W + 300, height: 150, background: "rgba(255,255,255,0.05)", transform: "rotate(-32deg)" }} />
            <div style={{ display: "flex", position: "absolute", left: -120, top: 520, width: PANEL_W + 300, height: 7, background: "rgba(217,164,65,0.85)", transform: "rotate(-32deg)" }} />
          </div>
          <div style={{ display: "flex", position: "absolute", left: PANEL_W - 8, top: 0, width: 8, height: HERO_H, background: OG.gold }} />
          {opts.hasHeadshot ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og JSX, not a browser page
            <img src={headshotUrl(p.id)} width={PANEL_W - 8} height={PHOTO_H} style={{ position: "absolute", left: 0, top: HERO_H - PHOTO_H, width: PANEL_W - 8, height: PHOTO_H, objectFit: "cover", objectPosition: "50% 14%" }} />
          ) : (
            <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: PANEL_W - 8, height: HERO_H - 90, alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 210, color: "rgba(255,255,255,0.9)" }}>
              {parts.map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}

          {/* name / team / points */}
          <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: PANEL_W + 36, top: 0, width: 1080 - PANEL_W - 36 - 28, height: HERO_H - 90, justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex", alignSelf: "flex-start", padding: "4px 20px", borderRadius: 8, background: OG.gold, color: OG.rinkDeep, fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: 4 }}>
              {opts.positionName.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.0, color: OG.board, maxWidth: 416, overflow: "hidden", whiteSpace: "nowrap" }}>{first}</div>
              {last ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.0, color: OG.board, maxWidth: 416, overflow: "hidden", whiteSpace: "nowrap" }}>{last}</div> : null}
            </div>
            <TeamLine name={p.teamName} logo={logo} size={LOGO_SIZE + 6} fontSize={28} align="flex-start" />
            {teamColor ? <div style={{ display: "flex", width: 120, height: 5, borderRadius: 2, background: teamColor }} /> : null}
            <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 124, lineHeight: 1, color: OG.centerRed }}>{p.points.toFixed(2)}</div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, letterSpacing: 6, color: OG.muted }}>FANTASY PTS</div>
            </div>
          </div>
        </div>

        {/* stat tiles overlap the bottom of the photo panel */}
        {opts.tiles.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "row", gap: 18, padding: "0 40px", marginTop: -90 }}>
            {opts.tiles.map((t) => (
              <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, height: TILE_H, borderRadius: CARD_RADIUS, borderTop: `6px solid ${OG.gold}`, backgroundImage: "linear-gradient(180deg, #1A4C7E 0%, #0C2740 100%)", boxShadow: CARD_SHADOW }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF" }}>{t.value}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: "#C9D6E6", marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
  });
}

// ---------------------------------------------------------------- matchup preview
export async function renderPortraitPreview(opts: { games: PreviewGame[]; week: number; footer?: string; logos?: Record<number, string> }) {
  const logos = opts.logos ?? {};
  const n = Math.max(1, opts.games.length);
  const GAP = 14;
  const DIV = 34;
  const avail = H - CHROME;
  const cardH = Math.min(190, Math.floor((avail - (n - 1) * GAP) / n));
  const rowH = Math.floor((cardH - DIV) / 2);
  const rankSize = Math.min(52, rowH - 10);
  const logoSize = Math.min(52, rowH - 10);
  const nameSize = rowH >= 70 ? 32 : rowH >= 58 ? 30 : 28;
  // Ranks only show when every team has one (none exist before week 2), and the subtitle follows.
  const showRank = opts.games.every((g) => g.home.rank != null && g.away.rank != null);
  // Before anyone has played, every record is 0-0 and says nothing: leave it off.
  const allZero = opts.games.every((g) => /^0-0(-0)?$/.test(g.home.record) && /^0-0(-0)?$/.test(g.away.record));

  return frame({
    title: `Week ${opts.week} matchups`,
    subtitle: allZero ? "Season opener" : showRank ? "Power rank and record going in" : "Records going in",
    bold: true,
    footer: opts.footer,
    body: ({ display }) => {
      const row = (s: PreviewGame["home"]) => (
        <div style={{ display: "flex", alignItems: "center", height: rowH, padding: "0 28px", gap: 18 }}>
          {showRank && s.rank ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: rankSize, height: rankSize, borderRadius: 10, background: OG.rink, color: "#FFFFFF", fontFamily: display, fontWeight: 700, fontSize: Math.round(rankSize * 0.54) }}>
              {s.rank}
            </div>
          ) : null}
          <TeamBadge name={s.name} logo={logos[s.teamId]} size={logoSize} fontFamily={display} />
          <div style={{ display: "flex", flexGrow: 1, fontSize: nameSize, fontWeight: 600, lineHeight: 1.15, maxWidth: 560, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.name}</div>
          {allZero ? null : <div style={{ display: "flex", marginLeft: "auto", fontFamily: display, fontWeight: 700, fontSize: 36, color: OG.rink }}>{s.record}</div>}
        </div>
      );
      return (
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "space-between", paddingBottom: 12 }}>
          {opts.games.map((g, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: cardH, background: "#FFFFFF", boxShadow: CARD_SHADOW, border: CARD_BORDER, borderRadius: CARD_RADIUS }}>
              {row(g.home)}
              <div style={{ display: "flex", alignItems: "center", height: DIV, padding: "0 28px" }}>
                <div style={{ display: "flex", flex: 1, height: 2, background: OG.iceLine }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 28, margin: "0 16px", padding: "0 20px", borderRadius: 14, background: OG.centerRed, color: "#FFFFFF", fontFamily: display, fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>VS</div>
                {g.series ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 1, color: OG.rink, marginRight: 16 }}>{g.series}</div> : null}
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

// ---------------------------------------------------------------- standings
export async function renderPortraitStandings(opts: {
  rows: StandingsRow[];
  cutoff?: number; // playoff spots: a red line is drawn under this place
  title?: string;
  subtitle: string;
  footer?: string;
  logos?: Record<number, string>;
}) {
  const logos = opts.logos ?? {};
  const avail = H - CHROME - 52 - 12;
  const rowH = Math.min(100, Math.floor(avail / Math.max(1, opts.rows.length)));
  const badge = Math.min(60, rowH - 14);

  return frame({
    footer: opts.footer,
    title: opts.title ?? "Standings",
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 22, fontWeight: 700, color: OG.muted, textTransform: "uppercase" }}>
          <div style={{ display: "flex", width: 112, justifyContent: "center" }}>#</div>
          <div style={{ display: "flex", flexGrow: 1, paddingLeft: 8 }}>Team</div>
          <div style={{ display: "flex", width: 140, justifyContent: "center" }}>Record</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>PF</div>
          <div style={{ display: "flex", width: 130, justifyContent: "center" }}>PA</div>
        </div>
        {opts.rows.map((r, i) => (
          <div key={r.teamId} style={{ display: "flex", alignItems: "center", height: rowH, background: i === 0 ? "#F1F8FF" : i % 2 === 0 ? "#FFFFFF" : OG.icePanel, ...(opts.cutoff && i === opts.cutoff - 1 && i < opts.rows.length - 1 ? { borderBottom: `5px solid ${OG.centerRed}` } : {}) }}>
            <div style={{ display: "flex", width: 112, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: i === 0 ? 40 : 34, fontWeight: 700, color: i === 0 ? OG.goldText : OG.rink }}>{i + 1}</div>
              {r.change ? <div style={{ display: "flex", fontFamily: display, fontSize: 22, fontWeight: 700, color: r.change > 0 ? "#1F7A4D" : OG.centerRed }}>{`${r.change > 0 ? "\u25B2" : "\u25BC"}${Math.abs(r.change)}`}</div> : null}
            </div>
            <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 16, paddingLeft: 8 }}>
              <TeamBadge name={r.name} logo={logos[r.teamId]} size={badge} fontFamily={display} />
              <div style={{ display: "flex", fontSize: r.name.length > 27 ? 24 : r.name.length > 22 ? 26 : 28, fontWeight: 600, color: OG.board, maxWidth: 390, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 140 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: OG.rink }}>{r.record}</div>
              {r.streak && /^[WL]\d+$/.test(r.streak) ? <div style={{ display: "flex", fontFamily: display, fontSize: 20, fontWeight: 700, color: r.streak[0] === "W" ? "#1F7A4D" : OG.centerRed }}>{r.streak}</div> : null}
            </div>
            <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 26, color: OG.board }}>{fmtPts(r.pf)}</div>
            <div style={{ display: "flex", width: 130, justifyContent: "center", fontSize: 26, color: OG.muted }}>{fmtPts(r.pa)}</div>
          </div>
        ))}
      </div>
    ),
  });
}
