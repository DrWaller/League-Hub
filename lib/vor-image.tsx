import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { TeamLine } from "./og-team-logo";
import type { VorPlayer, WeekVor } from "./vor";

// Portrait (1080 x 1350) leaderboard of the week's best players by value over replacement, any position.
// Eight compact rows so the whole card reads at a glance. Same Satori rules as the other graphics:
// every element with more than one child needs display:flex, and text is a single precomputed string.

export const VOR_ROWS = 8;

const ROW_H = 118;
const RANK_COLORS = [OG.goldText, OG.silverText, OG.bronzeText];

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

export async function renderTopVorCard(opts: {
  vor: WeekVor;
  players: VorPlayer[]; // already cut to VOR_ROWS
  teamName: (id: number) => string;
  logos?: Record<number, string>;
  headshots: Set<number>;
  footer?: string;
  title: string;
}) {
  const logos = opts.logos ?? {};
  return frame({
    footer: opts.footer,
    title: opts.title,
    subtitle: `Week ${opts.vor.week} - value over replacement`,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {opts.players.map((p, i) => {
          const first = i === 0;
          const rankColor = RANK_COLORS[i] ?? OG.rink;
          return (
            <div
              key={p.id}
              style={{
                display: "flex", flexDirection: "row", alignItems: "center", gap: 18, height: ROW_H, padding: "0 24px",
                background: first ? "#F1F8FF" : "#FFFFFF",
                border: first ? `4px solid ${OG.gold}` : "1px solid #BCD5EA",
                borderRadius: 16,
                boxShadow: "0 6px 16px rgba(18,58,97,0.10)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", width: 56, flexShrink: 0, fontFamily: display, fontWeight: 700, fontSize: 56, lineHeight: 1, color: rankColor }}>{String(i + 1)}</div>
              <PlayerAvatar
                name={p.name}
                src={headshotUrl(p.id)}
                hasHeadshot={opts.headshots.has(p.id)}
                size={92}
                fontFamily={display}
                fontSize={34}
                border={`4px solid ${rankColor}`}
              />
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, gap: 6 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 38, lineHeight: 1.05, color: OG.board, maxWidth: 560, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", padding: "2px 12px", borderRadius: 8, background: OG.rink, fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: "#FFFFFF" }}>{p.position}</div>
                  <TeamLine name={opts.teamName(p.teamId)} logo={logos[p.teamId]} size={30} fontSize={22} align="flex-start" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 190, flexShrink: 0 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 60, lineHeight: 1, color: OG.centerRed }}>{signed(p.vor)}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: OG.muted, marginTop: 4 }}>{`${p.points.toFixed(2)} PTS`}</div>
              </div>
            </div>
          );
        })}
        {opts.players.length === 0 && <div style={{ display: "flex", color: OG.muted, fontSize: 28 }}>No player stats posted for this week yet.</div>}
      </div>
    ),
  });
}
