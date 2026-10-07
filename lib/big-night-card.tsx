import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { OG } from "./og-theme";
import { TeamLine } from "./og-team-logo";
import { STAT_META } from "./espn-stats";
import type { NightlyBlurb } from "./nightly-blurbs";

// One portrait (1080 x 1350) card for ONE player's big night, laid out like the
// Player Spotlight: headshot with the gold ring, position, name, team, points,
// stat tiles. Built on frame() so the header, rink background and footer match.
// Same Satori rules as the other graphics: every element with more than one
// child needs display:flex, and text is a single precomputed string.

export type LogoStyle = "badge" | "inline" | "watermark" | "pair";

// Where the team logo goes (teams with no logo uploaded show none of these):
//   badge     = round logo on the lower-right of the headshot
//   inline    = small logo beside the team name
//   watermark = big, very faint logo behind the whole card
//   pair      = headshot and logo side by side
const LOGO_STYLE: LogoStyle = "watermark";

const POSITION_NAMES: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goaltender",
};

// Why the night was big, when there's a specific reason worth a tag.
// (A night that qualified on fantasy points alone gets no tag.)
const MILESTONE: Partial<Record<NightlyBlurb["kind"], string>> = {
  HAT_TRICK: "HAT TRICK",
  MULTI_GOAL: "MULTI-GOAL NIGHT",
  BIG_POINTS: "BIG POINTS NIGHT",
  SHUTOUT: "SHUTOUT",
  SAVE_FEST: "40+ SAVES",
  MELTDOWN: "ROUGH NIGHT",
};

// Tile names by ESPN stat id; anything not listed falls back to the short name in lib/espn-stats.ts.
const TILE_LABEL: Record<string, string> = {
  "13": "GOALS", "14": "ASSISTS", "29": "SHOTS", "31": "HITS", "32": "BLOCKS",
  "18": "PP GOALS", "19": "PP ASSISTS", "38": "PP POINTS", "20": "SH GOALS", "21": "SH ASSISTS", "39": "SH POINTS",
  "22": "GW GOALS", "28": "HAT TRICK", "15": "+/-", "17": "PIM", "23": "FACEOFFS WON", "24": "FACEOFFS LOST",
  "35": "ST GOALS", "36": "ST ASSISTS", "37": "ST POINTS",
  "1": "WINS", "2": "LOSSES", "3": "SHOTS AGAINST", "4": "GOALS AGAINST", "6": "SAVES", "7": "SHUTOUT", "9": "OT LOSSES", "8": "MINUTES", "0": "STARTS",
};
// Most important first; anything else follows in id order.
const TILE_ORDER = ["13", "14", "29", "38", "18", "19", "39", "20", "21", "22", "28", "31", "32", "15", "17", "23", "24", "37", "35", "36", "1", "6", "4", "7", "3", "9", "2", "8", "0"];

type Tile = { value: string; label: string };

// Every stat the league scores points for that the player actually recorded (more than 0).
function tilesFromStats(stats: Record<string, number>, scoredIds: Set<string>): Tile[] {
  const ids = Object.keys(stats).filter((id) => scoredIds.has(id) && !STAT_META[id]?.rate && Number(stats[id]) > 0);
  const rank = (id: string) => (TILE_ORDER.indexOf(id) === -1 ? 1000 + Number(id) : TILE_ORDER.indexOf(id));
  ids.sort((a, b) => rank(a) - rank(b));
  return ids.map((id) => {
    const v = Number(stats[id]);
    const value = id === "8" ? String(Math.round(v / 60)) : String(Math.round(v * 100) / 100);
    return { value, label: TILE_LABEL[id] ?? STAT_META[id]?.label ?? id };
  });
}

// Fallback when a night was saved without raw stats: the saved stat line
// ("2 G \u00b7 1 A \u00b7 3 SOG", "13 SV \u00b7 1.000 \u00b7 0 GA") back into tiles. A part with no label is a goalie's save percentage.
function tilesFromLine(line: string | null): Tile[] {
  if (!line) return [];
  const names: Record<string, string> = { G: "GOALS", A: "ASSISTS", SOG: "SHOTS", SV: "SAVES", GA: "GA" };
  return line.split(" \u00b7 ").map((part) => {
    const m = part.trim().match(/^(\S+)\s+(\S+)$/);
    return m ? { value: m[1], label: names[m[2]] ?? m[2] } : { value: part.trim(), label: "SV%" };
  });
}

function dateParts(ymd: string): { month: string; day: string } {
  const d = new Date(`${ymd}T12:00:00Z`);
  return {
    month: d.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
    day: String(d.getUTCDate()),
  };
}

export async function renderBigNightCard(opts: {
  date: string; // YYYY-MM-DD
  blurb: NightlyBlurb;
  footer: string;
  logos: Record<number, string>;
  hasHeadshot: boolean;
  scoredIds?: Set<string>; // stat ids the league scores points for (empty/missing = use the saved stat line)
  logoStyle?: LogoStyle;
}) {
  const { blurb: b, logos } = opts;
  const logoStyle = opts.logoStyle ?? LOGO_STYLE;
  const logo = logos[b.teamId];
  const { month, day } = dateParts(opts.date);
  const tiles =
    b.stats && opts.scoredIds && opts.scoredIds.size > 0 ? tilesFromStats(b.stats, opts.scoredIds) : tilesFromLine(b.statLine);
  const tag = MILESTONE[b.kind];
  const nameSize = b.playerName.length > 20 ? 56 : 72;

  // More tiles than fit in one row: smaller photo and points, tiles wrap into a grid.
  const n = tiles.length;
  const compact = n > 4;
  const cols = n <= 3 ? Math.max(1, n) : n === 4 ? 4 : n <= 6 ? 3 : 4;
  const GAP = 18;
  const ROW_W = 904;
  const tileW = n <= 3 ? 200 : Math.floor((ROW_W - GAP * (cols - 1)) / cols);
  const tileValue = n <= 3 ? 60 : cols === 4 ? 48 : 52;
  const tileLabel = n <= 3 ? 20 : 16;
  const photo = compact ? 240 : 300;

  const avatar = (display: string) => (
    <PlayerAvatar name={b.playerName} src={headshotUrl(b.playerId)} hasHeadshot={opts.hasHeadshot} size={photo} fontFamily={display} fontSize={compact ? 84 : 104} border={`8px solid ${OG.gold}`} />
  );

  return frame({
    footer: opts.footer,
    title: "Big Night",
    subtitle: "",
    headerContent: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: 968 }}>
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
          Big Night
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "8px 28px 10px 28px", border: `3px solid ${OG.gold}`, borderRadius: 16 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>{month}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 92, lineHeight: 1, color: OG.gold }}>{day}</div>
        </div>
      </div>
    ),
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingBottom: 8 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            position: "relative",
            overflow: "hidden",
            background: "#FFFFFF",
            borderTop: `8px solid ${OG.gold}`,
            borderLeft: `1px solid ${OG.iceLine}`,
            borderRight: `1px solid ${OG.iceLine}`,
            borderBottom: `1px solid ${OG.iceLine}`,
            borderRadius: 12,
            boxShadow: "0 6px 16px rgba(18,58,97,0.10)",
            padding: compact ? "20px 40px" : "28px 40px",
          }}
        >
          {logoStyle === "watermark" && logo ? (
            <div style={{ display: "flex", position: "absolute", left: 140, top: 150, width: 700, height: 700, alignItems: "center", justifyContent: "center", opacity: 0.08 }}>
              <img src={logo} width={700} height={700} style={{ objectFit: "contain" }} />
            </div>
          ) : null}

          {logoStyle === "pair" && logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              {avatar(display)}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: photo, height: photo, background: OG.icePanel, border: `3px solid ${OG.iceLine}`, borderRadius: 28 }}>
                <img src={logo} width={photo - 56} height={photo - 56} style={{ objectFit: "contain" }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", position: "relative", width: photo, height: photo }}>
              {avatar(display)}
              {logoStyle === "badge" && logo ? (
                <div style={{ display: "flex", position: "absolute", right: -26, bottom: -10, width: 156, height: 156, borderRadius: 78, background: "#FFFFFF", border: `5px solid ${OG.gold}`, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={logo} width={120} height={120} style={{ objectFit: "contain" }} />
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 4, color: OG.goldText, marginTop: compact ? 18 : 26 }}>
            {(POSITION_NAMES[b.position] ?? b.position).toUpperCase()}
          </div>
          <div style={{ display: "flex", fontFamily: display, fontSize: nameSize, fontWeight: 700, color: OG.board, lineHeight: 1.1, marginTop: 6, textAlign: "center" }}>{b.playerName}</div>
          <div style={{ display: "flex", marginTop: 10 }}>
            {logoStyle === "inline" ? (
              <TeamLine name={b.teamName} logo={logo} size={44} fontSize={30} align="center" />
            ) : (
              <div style={{ display: "flex", fontSize: 30, color: OG.muted }}>{b.teamName}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: compact ? 10 : 18 }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: compact ? 104 : 128, fontWeight: 700, color: OG.centerRed, lineHeight: 1 }}>{b.points.toFixed(2)}</div>
            <div style={{ display: "flex", fontFamily: display, fontSize: 34, fontWeight: 700, color: OG.muted, letterSpacing: 2, paddingBottom: 10 }}>PTS</div>
          </div>
          {tag ? (
            <div style={{ display: "flex", marginTop: 12, fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: 3, color: OG.goldText, border: `3px solid ${OG.gold}`, borderRadius: 999, padding: "6px 26px" }}>{tag}</div>
          ) : null}
          {b.active ? null : (
            <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: OG.muted }}>Not in the active lineup, so these points did not count</div>
          )}
          {n > 0 ? (
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: GAP, marginTop: compact ? 22 : 30, width: ROW_W }}>
              {tiles.map((t) => (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: tileW, background: OG.rink, borderRadius: 12, padding: compact ? "10px 8px" : "16px 12px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: tileValue, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>{t.value}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: tileLabel, fontWeight: 700, letterSpacing: 2, color: "#C9D6E6" }}>{t.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
  });
}
