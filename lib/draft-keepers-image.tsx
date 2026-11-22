import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import type { AssessedPick } from "./draft-assessment";
import { TIER_STYLE, TIERS, type Tier } from "./tier-style";

// Portrait (1080 x 1350) graphic ranking every team's keepers: rank, team, tier chips and the combined season VOR of
// the team's keepers. Satori: every element with more than one child needs display:flex.

export interface KeeperTeam {
  team: string;
  vor: number;
  counts: Record<Tier, number>;
  names: string[]; // keeper last names, best first
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderKeeperRanking(opts: { teams: KeeperTeam[]; footer?: string }) {
  const n = Math.max(1, opts.teams.length);
  const rowH = Math.min(104, Math.floor((1094 - 24 - 40 - (n - 1) * 8) / n));
  return frame({
    dark: true,
    flush: true,
    footer: opts.footer,
    title: "Keeper Rankings",
    subtitle: "",
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 40, gap: 14, padding: "0 18px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          <div style={{ display: "flex", width: 60, justifyContent: "center" }}>#</div>
          <div style={{ display: "flex", flexGrow: 1 }}>TEAM</div>
          <div style={{ display: "flex", width: 190, justifyContent: "flex-end" }}>KEEPER VOR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.teams.map((t, i) => {
            const room = 1024 - 36 - 60 - 190 - 14 * 3;
            const nameSize = fit(room, t.team.length, 24, 40);
            return (
              <div key={t.team} style={{ display: "flex", alignItems: "center", gap: 14, height: rowH, flexShrink: 0, padding: "0 18px", borderRadius: 14, background: "#1B3A5C", color: "#FFFFFF" }}>
                <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1, color: i === 0 ? "#D9A441" : "#FFFFFF" }}>{String(i + 1)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, whiteSpace: "nowrap" }}>{t.team}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {TIERS.filter((x) => t.counts[x] > 0).map((x) => (
                      <div key={x} style={{ display: "flex", padding: "2px 9px", borderRadius: 6, background: TIER_STYLE[x].bg, color: x === "Superstar" ? "#FFFFFF" : TIER_STYLE[x].fg, fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{`${t.counts[x]} ${x}`}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", width: 190, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{signed(t.vor)}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}

// ---------------------------------------------------------------- per-team keeper cards (same look as the site)
const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));

// One team's keepers as white cards with tier-coloured Season / VOR / Tier tiles, like the Keepers tab on the site.
export async function renderKeeperCards(opts: { team: string; vor: number; picks: AssessedPick[]; footer?: string; headshots?: Set<number> }) {
  const headshots = opts.headshots ?? new Set<number>();
  const n = Math.max(1, opts.picks.length);
  const gap = 16;
  const cardH = Math.min(290, Math.floor((1350 - 192 - 64 - 40 - (n - 1) * gap) / n));
  const tileH = Math.round(cardH * 0.4);
  const avatar = Math.round(cardH * 0.3);
  return frame({
    title: opts.team,
    subtitle: `Keepers · keeper VOR ${signed(opts.vor)}`,
    footer: opts.footer,
    compactHeader: false,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {opts.picks.map((p) => {
          const t = p.tier;
          const st = t ? TIER_STYLE[t] : { bg: "#EEF2F6", fg: "#5B6672" };
          const fg = t === "Superstar" ? "#FFFFFF" : st.fg;
          const g = p.perTeamGame != null;
          const tile = (label: string, value: string, sub: string, key: string) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, flexBasis: 0, height: tileH, paddingBottom: 6, borderRadius: 16, background: st.bg, color: fg, textShadow: t === "Superstar" ? "0 2px 3px rgba(60,40,0,0.35)" : "none" }}>
              <div style={{ display: "flex", fontSize: Math.round(tileH * 0.17), lineHeight: 1.1 }}>{label}</div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: Math.round(tileH * 0.38), lineHeight: 1.1 }}>{value}</div>
              <div style={{ display: "flex", fontSize: Math.round(tileH * 0.15), lineHeight: 1.1, minHeight: Math.round(tileH * 0.17) }}>{sub}</div>
            </div>
          );
          return (
            <div key={p.overall} style={{ display: "flex", background: "#FFFFFF", border: "3px solid #D5DEE8", borderRadius: 22, overflow: "hidden", height: cardH, flexShrink: 0 }}>
              <div style={{ display: "flex", width: 14, background: st.bg }} />
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(cardH * 0.06), flexGrow: 1, padding: `0 ${Math.round(cardH * 0.09)}px` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <PlayerAvatar name={p.name} src={p.playerId != null ? headshotUrl(p.playerId) : ""} hasHeadshot={p.playerId != null && headshots.has(p.playerId)} size={avatar} fontFamily={display} fontSize={Math.round(avatar * 0.36)} border="4px solid #D9A441" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", fontSize: Math.round(cardH * 0.16), fontWeight: 700, color: "#0C2740", lineHeight: 1.05, whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ display: "flex", fontSize: Math.round(cardH * 0.1), color: "#5B6672", lineHeight: 1.1 }}>{[p.nhl, p.position].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  {tile("Season", f2(g ? p.perTeamGame : p.avg), g ? "per team gm" : p.gp != null ? `${p.gp} gp` : "", "s")}
                  {tile("VOR", f2(p.vor), "season", "v")}
                  {tile("Tier", t ?? "Not placed", "", "t")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}
