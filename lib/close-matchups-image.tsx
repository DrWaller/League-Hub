import { OG } from "./og-theme";
import { TeamBadge } from "./og-team-logo";
import { frame } from "./portrait-graphics";
import { CloseGame, CloseMode, TIER_LABELS, daysLeftText } from "./close-matchups";

// Close Matchups (portrait 1080 x 1350). Same Satori rules as the other graphics: every element
// with more than one child needs display:flex, and text cells hold ONE precomputed string.
// Layout numbers mirror lib/portrait-graphics.tsx (H, and CHROME = header 192 + footer 64 + padding 40).
const H = 1350;
const CHROME = 192 + 64 + 40;
const GREEN_TINT = "#DCEFE4"; // final winner (same as the scoreboard)
const GOLD_TINT = "#FBEFD0"; // live leader: not decided yet, so not green
const CARD_RADIUS = 18;
const CARD_BORDER = "1px solid #BCD5EA";
const CARD_SHADOW = "0 6px 16px rgba(18,58,97,0.10)";

export async function renderPortraitCloseMatchups(opts: {
  games: CloseGame[];
  week: number;
  mode: CloseMode;
  margin: number;
  daysLeft: number | null;
  teamName: (id: number) => string;
  logos?: Record<number, string>;
  footer?: string;
  pastSeason?: number; // set for a previous season: the year goes in the header, no week badge
}) {
  const { games, week, mode, teamName } = opts;
  const logos = opts.logos ?? {};
  const live = mode === "live";
  const left = daysLeftText(opts.daysLeft);

  const baseTitle = live ? "Too close to call" : "Closest finishes";
  const title = opts.pastSeason ? `${baseTitle} - ${opts.pastSeason}` : baseTitle;
  const subtitle = live ? `Week ${week} · live${left ? ` · ${left.toLowerCase()}` : ""}` : `Week ${week} · final scores`;

  const GAP = 16;
  const NOTE_H = 40;
  const TOP_H = 56; // coloured tier band at the top of each card
  const n = Math.max(1, games.length);
  const avail = H - CHROME - NOTE_H;
  const cardH = Math.min(260, Math.floor((avail - (n - 1) * GAP) / n));
  const rowH = Math.floor((cardH - TOP_H) / 2);
  const badge = Math.min(64, rowH - 14);
  const nameSize = rowH >= 70 ? 32 : 28;

  return frame({
    footer: opts.footer,
    title,
    subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
        {games.map((g, i) => {
          const tie = g.leaderId == null;
          const homeLeads = g.homeScore >= g.awayScore; // leader on top; home on top when tied
          const sides = homeLeads
            ? [
                { id: g.homeTeamId, score: g.homeScore },
                { id: g.awayTeamId, score: g.awayScore },
              ]
            : [
                { id: g.awayTeamId, score: g.awayScore },
                { id: g.homeTeamId, score: g.homeScore },
              ];

          const bandBg = g.tier === 0 ? OG.centerRed : g.tier === 1 ? OG.gold : OG.rink;
          const bandFg = g.tier === 1 ? OG.rinkDeep : "#FFFFFF";
          const marginText = tie ? "TIED" : live ? `LEADS BY ${g.margin.toFixed(2)}` : `BY ${g.margin.toFixed(2)}`;

          const row = (s: { id: number; score: number }, top: boolean) => {
            const leads = !tie && top;
            const tint = leads ? (live ? GOLD_TINT : GREEN_TINT) : null;
            return (
              <div key={s.id} style={{ display: "flex", flex: 1, alignItems: "center", gap: 16, padding: "0 20px" }}>
                <TeamBadge name={teamName(s.id)} logo={logos[s.id]} size={badge} fontFamily={display} />
                <div style={{ display: "flex", flexGrow: 1, fontSize: nameSize, fontWeight: leads || tie ? 700 : 400, color: leads || tie ? OG.board : OG.muted, maxWidth: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {teamName(s.id)}
                </div>
                <div
                  style={{
                    display: "flex", justifyContent: "center", alignItems: "center", width: 170, height: 52,
                    fontFamily: display, fontSize: 38, fontWeight: 700, color: leads || tie ? OG.board : OG.muted,
                    ...(tint ? { background: tint, borderRadius: 6 } : {}),
                  }}
                >
                  {s.score.toFixed(2)}
                </div>
              </div>
            );
          };

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: cardH, overflow: "hidden", background: "#FFFFFF", boxShadow: CARD_SHADOW, border: CARD_BORDER, borderRadius: CARD_RADIUS }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: TOP_H, padding: "0 20px", background: bandBg }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: bandFg }}>{TIER_LABELS[mode][g.tier]}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, letterSpacing: 1, color: bandFg }}>{marginText}</div>
              </div>
              {row(sides[0], true)}
              <div style={{ display: "flex", height: 1, background: OG.iceLine, marginLeft: 20, marginRight: 20 }} />
              {row(sides[1], false)}
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4, fontSize: 22, fontWeight: 600, color: OG.rink }}>
          {live ? `Scores right now - games still to play. Showing gaps up to ${opts.margin.toFixed(2)} pts.` : `Final scores. Showing games decided by ${opts.margin.toFixed(2)} pts or less.`}
        </div>
      </div>
    ),
  });
}
