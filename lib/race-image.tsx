import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { TeamBadge } from "./og-team-logo";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";

// One portrait (1080 x 1350) graphic for any season-long award race: top 5 rows, each with a player
// headshot or a team logo, a name, a small detail line, a big number and the gap to the leader.
// Satori rules: every element with more than one child needs display:flex.

export interface RaceRow {
  rank: number;
  name: string;
  sub: string;
  value: string; // the big number
  gap: string; // "leader", "-3.20", ...
  playerId?: number; // draws a headshot
  teamId?: number; // draws that team's logo (when there is no player)
  teamName?: string;
}

const MEDAL = [OG.gold, OG.silver, OG.bronze];
const MEDAL_TEXT = [OG.goldText, OG.silverText, OG.bronzeText];

export async function renderPortraitRace(opts: {
  title: string;
  subtitle: string;
  footer?: string;
  rows: RaceRow[];
  logos?: Record<number, string>;
  headshots?: Set<number>;
}) {
  const logos = opts.logos ?? {};
  const headshots = opts.headshots ?? new Set<number>();
  const rows = opts.rows.slice(0, 5);
  return frame({
    footer: opts.footer,
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 18 }}>
        {rows.map((r, i) => {
          const first = i === 0;
          const size = first ? 176 : 132;
          // Fixed row heights (a race with fewer than 5 entries leaves space at the bottom instead of stretching).
          const rowH = first ? 250 : 186;
          // One line per name: shrink long names to fit the space between the avatar and the big number.
          const nameRoom = 984 - 56 - 70 - 22 - size - 22 - 22 - 215;
          const nameSize = Math.max(26, Math.min(first ? 46 : 38, Math.floor(nameRoom / (Math.max(1, r.name.length) * 0.5))));
          const accent = MEDAL[i] ?? OG.iceLine;
          const accentText = MEDAL_TEXT[i] ?? OG.muted;
          return (
            <div
              key={`${r.rank}-${r.name}`}
              style={{
                display: "flex", position: "relative", overflow: "hidden", flexShrink: 0, height: rowH, alignItems: "center", gap: 22, padding: "0 28px",
                background: first ? "#F1F8FF" : "#FFFFFF",
                border: first ? `4px solid ${OG.gold}` : "1px solid #BCD5EA",
                borderRadius: 18,
                boxShadow: "0 6px 16px rgba(18,58,97,0.10)",
              }}
            >
              <div style={{ display: "flex", width: 70, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: first ? 120 : 84, lineHeight: 1, color: accentText }}>{r.rank}</div>
              {r.playerId != null ? (
                <PlayerAvatar
                  name={r.name}
                  src={headshotUrl(r.playerId)}
                  hasHeadshot={headshots.has(r.playerId)}
                  size={size}
                  fontFamily={display}
                  fontSize={first ? 64 : 48}
                  border={`${first ? 6 : 5}px solid ${accent}`}
                />
              ) : r.teamId != null ? (
                <TeamBadge name={r.teamName ?? r.name} logo={logos[r.teamId]} size={size} fontFamily={display} />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 6 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.1, color: OG.board, whiteSpace: "nowrap", overflow: "hidden" }}>{r.name}</div>
                <div style={{ display: "flex", fontSize: first ? 25 : 22, lineHeight: 1.2, color: OG.muted, overflow: "hidden", maxHeight: 68 }}>{r.sub}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 4 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: first ? 64 : 48, lineHeight: 1, color: OG.rink }}>{r.value}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 1.5, color: i === 0 ? accentText : OG.muted, textTransform: "uppercase" }}>{r.gap}</div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}
