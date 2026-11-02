import { frame } from "./portrait-graphics";
import { TeamBadge } from "./og-team-logo";
import { PlayerAvatar } from "./og-avatar";
import { TierPill } from "./og-tier";
import type { Tier } from "./tier-style";
import { headshotUrl } from "./headshots";

// The "scoreboard" portrait (1080 x 1350) for the player award races (Hart, Norris, Vezina, forward, Art Ross):
// navy table, one row per player, columns for PTS / VOR / gap to the leader, a gold-highlighted leader.
// Satori rules: every element with more than one child needs display:flex.

export interface ScoreboardPlayer {
  id: number;
  name: string;
  pos?: string;
  teamId: number;
  teamName: string;
  points: number;
  vor?: number; // when set VOR is the big number and points the small one
  tier?: Tier | null;
}

const GOLD = "#F2C46D";
const RANK_COLOR = [GOLD, "#C3CEDA", "#E3A57A", "#8FB4DA", "#8FB4DA"];
const RING = [GOLD, "#8A94A0", "#A0673D", "#5B86B3", "#5B86B3"];
const W_PTS = 100;
const W_BIG = 200;
const W_GAP = 110;
const GAP = 14;

const num = (n: number) => n.toFixed(2);
const vorText = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
// Oswald is condensed: about half an em per character. Shrink text to fit its column instead of clipping it.
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderRaceScoreboard(opts: {
  title: string;
  subtitle: string;
  footer?: string;
  players: ScoreboardPlayer[];
  logos?: Record<number, string>;
  headshots: Set<number>;
  emptyMessage?: string;
}) {
  const logos = opts.logos ?? {};
  const players = opts.players.slice(0, 5);
  const hasVor = players.some((p) => p.vor !== undefined);
  const big = (p: ScoreboardPlayer) => (hasVor ? p.vor ?? 0 : p.points);
  const lead = players.length ? big(players[0]) : 0;
  const smallCol = hasVor ? W_PTS + GAP : 0; // no points column when points ARE the big number
  return frame({
    dark: true,
    flush: true,
    footer: opts.footer,
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 52, gap: GAP, padding: "0 22px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          <div style={{ display: "flex", width: 64, justifyContent: "center" }}>RK</div>
          <div style={{ display: "flex", flexGrow: 1 }}>PLAYER</div>
          {hasVor ? <div style={{ display: "flex", width: W_PTS, justifyContent: "flex-end" }}>PTS</div> : null}
          <div style={{ display: "flex", width: W_BIG, justifyContent: "flex-end" }}>{hasVor ? "VOR" : "PTS"}</div>
          <div style={{ display: "flex", width: W_GAP, justifyContent: "flex-end" }}>VS #1</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {players.map((p, i) => {
            const first = i === 0;
            const avatar = first ? 124 : 96;
            const rowH = first ? 240 : 178;
            const gapVal = lead - big(p);
            // Room for the name column: row width less padding, rank, avatar, the number columns and the gaps between.
            const room = 1024 - 44 - 64 - avatar - W_BIG - W_GAP - smallCol - GAP * (hasVor ? 5 : 4);
            const nameSize = fit(room, p.name.length, 24, first ? 48 : 38);
            const logo = logos[p.teamId];
            const detail = `${p.teamName}${p.pos ? ` · ${p.pos}` : ""}`;
            const detailSize = fit(room, detail.length + (logo ? 3 : 0), 16, first ? 26 : 23);
            return (
              <div
                key={p.id}
                style={{
                  display: "flex", alignItems: "center", gap: GAP, height: rowH, flexShrink: 0, padding: "0 22px", borderRadius: 16,
                  ...(first
                    ? { backgroundImage: "linear-gradient(90deg, #7A5712 0%, #3B3216 40%, #14304F 100%)", border: `2px solid ${GOLD}` }
                    : { background: "#173454", border: "1px solid #2A4E75" }),
                }}
              >
                <div style={{ display: "flex", width: 64, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: first ? 104 : 70, lineHeight: 1, color: RANK_COLOR[i] }}>{i + 1}</div>
                <PlayerAvatar name={p.name} src={headshotUrl(p.id)} hasHeadshot={opts.headshots.has(p.id)} size={avatar} fontFamily={display} fontSize={first ? 46 : 34} border={`${first ? 5 : 4}px solid ${RING[i]}`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, color: "#FFFFFF", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: detailSize, color: first ? "#E6ECF3" : "#B8C7D6", whiteSpace: "nowrap" }}>
                    {logo ? <TeamBadge name={p.teamName} logo={logo} size={Math.round(detailSize * 1.3)} /> : null}
                    <div style={{ display: "flex" }}>{detail}</div>
                  </div>
                  <TierPill tier={p.tier} size={first ? 20 : 18} align="flex-start" onDark />
                </div>
                {hasVor ? <div style={{ display: "flex", width: W_PTS, justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: first ? 34 : 30, color: "#D5DEE8" }}>{num(p.points)}</div> : null}
                <div style={{ display: "flex", width: W_BIG, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: first ? 62 : 50, lineHeight: 1, color: first ? GOLD : "#FFFFFF" }}>{hasVor ? vorText(big(p)) : num(big(p))}</div>
                <div style={{ display: "flex", width: W_GAP, justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: first ? 28 : 28, letterSpacing: first ? 2 : 0, color: first ? GOLD : "#FF8FA0" }}>{first ? "LEADS" : `-${num(gapVal)}`}</div>
              </div>
            );
          })}
          {players.length === 0 && <div style={{ display: "flex", color: "#9FB3C8", fontSize: 28 }}>{opts.emptyMessage ?? "No finished weeks yet."}</div>}
        </div>
      </div>
    ),
  });
}
