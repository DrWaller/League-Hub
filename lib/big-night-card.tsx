import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { OG } from "./og-theme";
import { STAT_META } from "./espn-stats";
import { isMonsterNight, type NightlyBlurb } from "./nightly-blurbs";

// One portrait (1080 x 1350) card for ONE player's big night, laid out like the
// Player Spotlight: headshot with the gold ring, position, name, team, points,
// stat tiles. Built on frame() so the header, rink background and footer match.
// Same Satori rules as the other graphics: every element with more than one
// child needs display:flex, and text is a single precomputed string.

export type LogoStyle =
  | "badge" | "inline" | "watermark" | "pair" | "badge+watermark" | "pair+watermark" | "corner+watermark"
  | "header" | "banner" | "strip" | "score" | "nameplate";

// Where the team logo goes (teams with no logo uploaded show none of these):
//   badge     = round logo on the lower-right of the headshot
//   inline    = a larger logo beside the team name, with the name kept centered
//   watermark = big, very faint logo behind the whole card
//   pair      = headshot and logo side by side
//   corner    = a clear logo in the card's top-right corner
//   header    = the logo in a white circle at the left of the page header
//   banner    = a band in the team's color across the top of the card, with logo and team name
//   strip     = a navy strip along the bottom of the card with logo and team name
//   score     = the logo beside the points number
//   nameplate = a large logo beside the player's name
//   "x+watermark" = that logo placement plus a lighter watermark behind everything
const LOGO_STYLE: LogoStyle = "inline";

// Watermark strength (0 = invisible, 1 = solid). Busy or strongly colored logos get less so the
// player's name and points stay easy to read. Keyed by ESPN team id; anything not listed uses the default.
// Logo size (pixels) beside the team name in the "inline" layout.
const INLINE_LOGO_SIZE = 90;

const WATERMARK_DEFAULT = 0.07;
const WATERMARK_BY_TEAM: Record<number, number> = {
  10: 0.045, // Reinhart of the Cards: very detailed
  9: 0.055, // Randy's 18-Wheelers: strong red
  7: 0.055, // Carter's Club: solid purple disc
  2: 0.08, // Hagel and Cream Cheese: soft blues, can take more
  1: 0.06, // Mighty Tkachuks: a face in the middle
};

// Team colors (from each logo) for the banner layout; any team not listed gets the site navy.
const TEAM_COLOR: Record<number, string> = {
  1: "#034946", // Mighty Tkachuks
  2: "#215070", // Hagel and Cream Cheese
  5: "#C11C2C", // DANtastic SENSations
  7: "#51287E", // Carter's Club
  9: "#D61C18", // Randy's 18-Wheelers
  10: "#1B2554", // Reinhart of the Cards
};

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
  watermarkOpacity?: number; // overrides the per-team strength (for testing)
  inlineLogoSize?: number; // overrides INLINE_LOGO_SIZE (for testing)
}) {
  const { blurb: b, logos } = opts;
  const logoStyle = opts.logoStyle ?? LOGO_STYLE;
  const logo = logos[b.teamId];
  const placement = logoStyle.split("+")[0]; // badge | inline | watermark | pair | corner
  const wantsWatermark = placement === "watermark" || logoStyle.endsWith("+watermark");
  // When a clear logo is also shown, the watermark steps back.
  const watermark = (opts.watermarkOpacity ?? WATERMARK_BY_TEAM[b.teamId] ?? WATERMARK_DEFAULT) * (logoStyle.includes("+") ? 0.6 : 1);
  const monster = isMonsterNight(b.points, b.position);
  const { month, day } = dateParts(opts.date);
  const teamColor = TEAM_COLOR[b.teamId] ?? OG.rink;
  const hasLogo = Boolean(logo);
  const inlineSize = opts.inlineLogoSize ?? INLINE_LOGO_SIZE;
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
  const tileValue = n <= 3 ? 68 : cols === 4 ? 54 : 58;
  const tileLabel = n <= 3 ? 20 : 16;
  const photo = compact ? 240 : 300;

  const avatar = (display: string) => (
    <div style={{ display: "flex", borderRadius: photo / 2, boxShadow: "0 10px 22px rgba(18,58,97,0.25)" }}>
      <PlayerAvatar name={b.playerName} src={headshotUrl(b.playerId)} hasHeadshot={opts.hasHeadshot} size={photo} fontFamily={display} fontSize={compact ? 84 : 104} border={`8px solid ${OG.gold}`} />
    </div>
  );

  return frame({
    footer: opts.footer,
    title: monster ? "Monster Night" : "Big Night",
    subtitle: "",
    headerContent: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: 968 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 26 }}>
          {placement === "header" && logo ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 132, height: 132, borderRadius: 66, background: "#FFFFFF", border: `4px solid ${OG.gold}`, overflow: "hidden" }}>
              <img src={logo} width={104} height={104} style={{ objectFit: "contain" }} />
            </div>
          ) : null}
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: placement === "header" && monster ? 70 : 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
            {monster ? "Monster Night" : "Big Night"}
          </div>
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
            borderLeft: monster ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
            borderRight: monster ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
            borderBottom: monster ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
            borderRadius: 12,
            boxShadow: monster ? "0 0 0 6px rgba(217,164,65,0.30), 0 6px 16px rgba(18,58,97,0.10)" : "0 6px 16px rgba(18,58,97,0.10)",
            padding: placement === "banner" ? (compact ? "0 40px 20px" : "0 40px 28px") : placement === "strip" ? (compact ? "20px 40px 150px" : "28px 40px 160px") : compact ? "20px 40px" : "28px 40px",
          }}
        >
          {wantsWatermark && logo ? (
            <div style={{ display: "flex", position: "absolute", left: 140, top: 150, width: 700, height: 700, alignItems: "center", justifyContent: "center", opacity: watermark }}>
              <img src={logo} width={700} height={700} style={{ objectFit: "contain" }} />
            </div>
          ) : null}

          {placement === "banner" ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 26, alignSelf: "stretch", height: 150, marginLeft: -40, marginRight: -40, padding: "0 44px", background: teamColor }}>
              {logo ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 118, height: 118, borderRadius: 59, background: "#FFFFFF", border: `4px solid ${OG.gold}`, overflow: "hidden", flexShrink: 0 }}>
                  <img src={logo} width={92} height={92} style={{ objectFit: "contain" }} />
                </div>
              ) : null}
              <div style={{ display: "flex", fontFamily: display, fontSize: 40, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1, textTransform: "uppercase" }}>{b.teamName}</div>
            </div>
          ) : null}

          {placement === "strip" ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, position: "absolute", left: 0, right: 0, bottom: 0, height: 128, background: OG.rink, borderTop: `5px solid ${OG.gold}` }}>
              {logo ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 92, height: 92, borderRadius: 46, background: "#FFFFFF", overflow: "hidden" }}>
                  <img src={logo} width={74} height={74} style={{ objectFit: "contain" }} />
                </div>
              ) : null}
              <div style={{ display: "flex", fontFamily: display, fontSize: 40, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1, textTransform: "uppercase" }}>{b.teamName}</div>
            </div>
          ) : null}

          {placement === "corner" && logo ? (
            <div style={{ display: "flex", position: "absolute", top: 22, right: 28, width: 170, height: 170, alignItems: "center", justifyContent: "center" }}>
              <img src={logo} width={170} height={170} style={{ objectFit: "contain" }} />
            </div>
          ) : null}

          {placement === "pair" && logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              {avatar(display)}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: photo, height: photo, background: OG.icePanel, border: `3px solid ${OG.iceLine}`, borderRadius: 28 }}>
                <img src={logo} width={photo - 56} height={photo - 56} style={{ objectFit: "contain" }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", position: "relative", width: photo, height: photo, marginTop: placement === "banner" ? -56 : 0 }}>
              {avatar(display)}
              {placement === "badge" && logo ? (
                <div style={{ display: "flex", position: "absolute", right: -26, bottom: -10, width: 156, height: 156, borderRadius: 78, background: "#FFFFFF", border: `5px solid ${OG.gold}`, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={logo} width={120} height={120} style={{ objectFit: "contain" }} />
                </div>
              ) : null}
            </div>
          )}

          {placement === "nameplate" && logo ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 30, marginTop: compact ? 18 : 26 }}>
              <img src={logo} width={150} height={150} style={{ objectFit: "contain" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 4, color: OG.goldText }}>{(POSITION_NAMES[b.position] ?? b.position).toUpperCase()}</div>
                <div style={{ display: "flex", fontFamily: display, fontSize: nameSize, fontWeight: 700, color: OG.board, lineHeight: 1.1, marginTop: 4 }}>{b.playerName}</div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: OG.rink, marginTop: 8 }}>{b.teamName}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: compact ? 18 : 26 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 4, color: OG.goldText }}>{(POSITION_NAMES[b.position] ?? b.position).toUpperCase()}</div>
              <div style={{ display: "flex", fontFamily: display, fontSize: nameSize, fontWeight: 700, color: OG.board, lineHeight: 1.1, marginTop: 6, textAlign: "center" }}>{b.playerName}</div>
              {placement === "banner" || placement === "strip" ? null : (
                <div style={{ display: "flex", marginTop: 10 }}>
                  {placement === "inline" ? (
                    // The team name stays dead center: equal-width slots on each side, with the logo in the left one.
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ display: "flex", width: inlineSize + 36, justifyContent: "flex-end", paddingRight: 18 }}>
                        {logo ? <img src={logo} width={inlineSize} height={inlineSize} style={{ objectFit: "contain" }} /> : null}
                      </div>
                      <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: OG.rink }}>{b.teamName}</div>
                      <div style={{ display: "flex", width: inlineSize + 36 }} />
                    </div>
                  ) : (
                    <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: OG.rink }}>{b.teamName}</div>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: compact ? 10 : 18 }}>
            {placement === "score" && logo ? <img src={logo} width={compact ? 130 : 160} height={compact ? 130 : 160} style={{ objectFit: "contain" }} /> : null}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end" }}>
            <div style={{ display: "flex", width: 124 }} />
            <div style={{ display: "flex", fontFamily: display, fontSize: compact ? 104 : 128, fontWeight: 700, color: OG.centerRed, lineHeight: 1 }}>{b.points.toFixed(2)}</div>
            <div style={{ display: "flex", width: 124, paddingLeft: 14, paddingBottom: 10, fontFamily: display, fontSize: 34, fontWeight: 700, color: OG.muted, letterSpacing: 2 }}>PTS</div>
          </div>
          </div>
          {tag ? (
            <div style={{ display: "flex", marginTop: 12, fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: 3, color: monster ? OG.board : OG.goldText, background: monster ? OG.gold : "#F7EBCB", border: `3px solid ${OG.gold}`, borderRadius: 999, padding: "6px 26px" }}>{tag}</div>
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
