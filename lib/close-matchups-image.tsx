import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { logoVisibleBox } from "./logo-trim";
import { CARD_TEAM_COLOR } from "./big-night-card";
import { CloseGame, CloseMode, TIER_LABELS, daysLeftText } from "./close-matchups";

// One portrait (1080 x 1350) card for ONE close matchup, laid out like the Big Night cards: the same
// header band, a white card with a gold top edge, team-color washes, big red numbers and a navy tile.
// The closest tier (within 1 point) gets the same gold glow a Monster Night does.
// Same Satori rules as the other graphics: every element with more than one child needs display:flex,
// and text is a single precomputed string.

const COL_W = 492; // the white card is 984 wide: one team per half
const DISC = 310; // team logo disc
const LOGO_BOX = { w: 235, h: 205 }; // the visible logo is fitted inside this

const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Team names are long ("Farsta Strand Consiglieres"): smaller type for longer names, wrapped to two lines.
const nameSize = (name: string) => (name.length <= 14 ? 56 : name.length <= 22 ? 48 : 42);

// The logo cut to its visible part (like the Big Night card), on a white disc ringed in the team's color.
function Medallion({ name, logo, color, display }: { name: string; logo?: string; color: string; display: string }) {
  const vis = logo ? logoVisibleBox(logo) : null;
  const s = vis ? Math.min(LOGO_BOX.w / vis.bw, LOGO_BOX.h / vis.bh) : 1;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: DISC, height: DISC, borderRadius: DISC / 2,
        border: `7px solid ${color}`, backgroundImage: `radial-gradient(circle, #FFFFFF 0%, #FFFFFF 62%, ${color}30 100%)`,
        boxShadow: "0 10px 22px rgba(18,58,97,0.18)",
      }}
    >
      {logo && vis ? (
        <div style={{ display: "flex", position: "relative", width: Math.round(vis.bw * s), height: Math.round(vis.bh * s), overflow: "hidden" }}>
          <img src={logo} width={Math.round(vis.w * s)} height={Math.round(vis.h * s)} style={{ position: "absolute", left: -Math.round(vis.x * s), top: -Math.round(vis.y * s) }} />
        </div>
      ) : logo ? (
        <img src={logo} width={LOGO_BOX.h} height={LOGO_BOX.h} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 120, color }}>{initialsOf(name)}</div>
      )}
    </div>
  );
}

export async function renderCloseMatchupCard(opts: {
  game: CloseGame;
  week: number;
  mode: CloseMode;
  daysLeft: number | null;
  teamName: (id: number) => string;
  logos?: Record<number, string>;
  footer?: string;
  pastSeason?: number; // set for a previous season: the year goes in the header, no week badge
}) {
  const { game: g, week, mode, teamName } = opts;
  const logos = opts.logos ?? {};
  const live = mode === "live";
  const tie = g.leaderId == null;
  const hot = g.tier === 0; // within 1 point: gold glow, like a Monster Night

  // The leader on the left (home on the left when tied).
  const homeLeads = g.homeScore >= g.awayScore;
  const left = homeLeads ? { id: g.homeTeamId, score: g.homeScore } : { id: g.awayTeamId, score: g.awayScore };
  const right = homeLeads ? { id: g.awayTeamId, score: g.awayScore } : { id: g.homeTeamId, score: g.homeScore };
  const colorL = CARD_TEAM_COLOR[left.id] ?? OG.rink;
  const colorR = CARD_TEAM_COLOR[right.id] ?? OG.rink;

  const label = TIER_LABELS[mode][g.tier];
  const title = opts.pastSeason ? `${label} - ${opts.pastSeason}` : label;
  const dayText = daysLeftText(opts.daysLeft);
  const subtitle = live ? `Week ${week} · live${dayText ? ` · ${dayText.toLowerCase()}` : ""}` : `Week ${week} · final`;

  const tileLabel = tie ? (live ? "ALL SQUARE" : "NO WINNER") : live ? "LEADS BY" : "WON BY";
  const tileNote = live ? dayText || "STILL IN PLAY" : "FINAL";
  const chipText = tie ? "" : live ? "LEADING" : "WINNER";

  return frame({
    footer: opts.footer,
    title,
    subtitle,
    body: ({ display }) => {
      const side = (s: { id: number; score: number }, color: string, leader: boolean) => {
        const name = teamName(s.id);
        const text = s.score.toFixed(2);
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: COL_W }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 46, marginTop: 26 }}>
              {leader && chipText ? (
                <div style={{ display: "flex", padding: "6px 26px 6px 31px", borderRadius: 8, background: OG.gold, fontFamily: display, fontWeight: 700, fontSize: 28, letterSpacing: 5, color: OG.board }}>{chipText}</div>
              ) : null}
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <Medallion name={name} logo={logos[s.id]} color={color} display={display} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 440, height: 112, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontFamily: display, fontWeight: 700, fontSize: nameSize(name), lineHeight: 1.05, color: OG.board, textTransform: "uppercase" }}>{name}</div>
            </div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: text.length > 6 ? 112 : text.length > 5 ? 132 : 150, lineHeight: 1, marginTop: 0, color: tie || leader ? OG.centerRed : OG.rink }}>{text}</div>
          </div>
        );
      };

      return (
        <div style={{ display: "flex", flexGrow: 1, paddingBottom: 8 }}>
          <div
            style={{
              display: "flex", position: "relative", flexGrow: 1, overflow: "hidden", background: "#FFFFFF",
              borderTop: `8px solid ${OG.gold}`,
              borderLeft: hot ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
              borderRight: hot ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
              borderBottom: hot ? `5px solid ${OG.gold}` : `1px solid ${OG.iceLine}`,
              borderRadius: 12,
              boxShadow: hot ? "0 0 0 6px rgba(217,164,65,0.30), 0 6px 16px rgba(18,58,97,0.10)" : "0 6px 16px rgba(18,58,97,0.10)",
            }}
          >
            {/* a team-color wash fading in from each outer edge, and a team-color strip along the bottom of each half */}
            <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: COL_W, height: 1040, backgroundImage: `linear-gradient(90deg, ${colorL}66 0%, ${colorL}26 55%, ${colorL}00 100%)` }} />
            <div style={{ display: "flex", position: "absolute", left: COL_W, top: 0, width: COL_W, height: 1040, backgroundImage: `linear-gradient(270deg, ${colorR}66 0%, ${colorR}26 55%, ${colorR}00 100%)` }} />
            <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width: COL_W, height: 12, background: colorL }} />
            <div style={{ display: "flex", position: "absolute", left: COL_W, bottom: 0, width: COL_W, height: 12, background: colorR }} />

            <div style={{ display: "flex", flexDirection: "row", position: "absolute", left: 0, top: 0 }}>
              {side(left, colorL, true)}
              {side(right, colorR, false)}
            </div>

            {/* the line between them, and the VS medallion on top of it, level with the logos */}
            <div style={{ display: "flex", position: "absolute", left: COL_W - 2, top: 0, width: 4, height: 672, backgroundImage: `linear-gradient(180deg, ${OG.gold}00 0%, ${OG.gold} 22%, ${OG.gold} 78%, ${OG.gold}00 100%)` }} />
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", left: COL_W - 66, top: 175, width: 132, height: 132, borderRadius: 66,
                background: OG.rink, border: `6px solid ${OG.gold}`, boxShadow: "0 0 0 8px #FFFFFF, 0 10px 22px rgba(18,58,97,0.30)",
                fontFamily: display, fontWeight: 700, fontSize: 60, letterSpacing: 2, color: OG.gold,
              }}
            >
              VS
            </div>

            {/* the gap, like a Big Night stat tile */}
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: 40, right: 40, bottom: 36,
                background: OG.rink, borderTop: `6px solid ${OG.gold}`, borderRadius: 14, padding: "14px 0 18px",
              }}
            >
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, letterSpacing: 7, color: "#C9D6E6" }}>{tileLabel}</div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", marginTop: 2 }}>
                {tie ? null : <div style={{ display: "flex", width: 132 }} />}
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 112, lineHeight: 1, color: "#FFFFFF", letterSpacing: tie ? 8 : 0 }}>{tie ? "TIED" : g.margin.toFixed(2)}</div>
                {tie ? null : <div style={{ display: "flex", width: 132, paddingLeft: 14, paddingBottom: 20, fontFamily: display, fontWeight: 700, fontSize: 36, letterSpacing: 2, color: "#C9D6E6" }}>PTS</div>}
              </div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 32, letterSpacing: 6, color: OG.gold, marginTop: 4 }}>{tileNote}</div>
            </div>
          </div>
        </div>
      );
    },
  });
}
