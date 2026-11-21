import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { TIER_STYLE } from "./tier-style";
import type { AssessedPick } from "./draft-assessment";
import { VALUE_TITLES, type ValueKind } from "./draft-value-split";

// Portrait (1080 x 1350) graphic for the draft Steals / Busts / Missed Time lists: tier-coloured rows like the round
// graphic, with the finish, season total and a navy "vs slot" pill. Satori: multi-child elements need display:flex.

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const W_FIN = 136;
const W_TOT = 120;
const W_VS = 170;
const GAP = 14;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderDraftValue(opts: { kind: ValueKind; picks: AssessedPick[]; footer?: string; headshots?: Set<number> }) {
  const headshots = opts.headshots ?? new Set<number>();
  const n = Math.max(1, opts.picks.length);
  const rowH = Math.min(104, Math.floor((1094 - 24 - 40 - (n - 1) * 8) / n));
  const avatar = Math.min(76, rowH - 22);
  const up = opts.kind === "steals";
  return frame({
    dark: true,
    flush: true,
    footer: opts.footer,
    title: `Draft ${VALUE_TITLES[opts.kind]}`,
    subtitle: "Season pts vs the player who finished at the pick's slot",
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 40, gap: GAP, padding: "0 18px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          <div style={{ display: "flex", width: 60, justifyContent: "center" }}>PK</div>
          <div style={{ display: "flex", flexGrow: 1, paddingLeft: avatar + GAP }}>PLAYER</div>
          <div style={{ display: "flex", width: W_FIN, justifyContent: "flex-end" }}>CURRENT</div>
          <div style={{ display: "flex", width: W_TOT, justifyContent: "flex-end" }}>TOTAL</div>
          <div style={{ display: "flex", width: W_VS, justifyContent: "flex-end" }}>VS SLOT</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.picks.map((p) => {
            const white = p.tier === "Superstar";
            const s = p.tier ? { bg: TIER_STYLE[p.tier].bg, fg: white ? "#FFFFFF" : TIER_STYLE[p.tier].fg } : { bg: "#2B4560", fg: "#C9D6E6" };
            const room = 1024 - 36 - 60 - avatar - W_FIN - W_TOT - W_VS - GAP * 5;
            const nameSize = fit(room, p.name.length, 22, 38);
            const subText = `${p.position} · ${p.team}${p.gp != null ? ` · ${p.gp} GP` : ""}`;
            const subSize = fit(room * 1.6, subText.length, 15, 22);
            return (
              <div key={p.overall} style={{ display: "flex", alignItems: "center", gap: GAP, height: rowH, flexShrink: 0, padding: "0 18px", borderRadius: 14, background: s.bg, color: s.fg, textShadow: white ? "0 2px 3px rgba(60,40,0,0.45)" : "none" }}>
                <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1 }}>{String(p.overall)}</div>
                <PlayerAvatar name={p.name} src={p.playerId != null ? headshotUrl(p.playerId) : ""} hasHeadshot={p.playerId != null && headshots.has(p.playerId)} size={avatar} fontFamily={display} fontSize={Math.round(avatar * 0.36)} border="3px solid rgba(255,255,255,0.7)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ display: "flex", fontSize: subSize, lineHeight: 1.1, opacity: white ? 1 : 0.88, whiteSpace: "nowrap" }}>{subText}</div>
                </div>
                <div style={{ display: "flex", width: W_FIN, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: 38, lineHeight: 1 }}>{p.finish != null ? `#${p.finish}` : "–"}</div>
                <div style={{ display: "flex", width: W_TOT, justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: 32, lineHeight: 1 }}>{f2(p.total)}</div>
                <div style={{ display: "flex", width: W_VS, justifyContent: "center", padding: "8px 0", borderRadius: 10, background: "#0C2740", textShadow: "none", fontFamily: display, fontWeight: 700, fontSize: 36, lineHeight: 1, color: up ? "#7BE0A0" : "#FF8FA0" }}>
                  {p.surplus != null ? signed(p.surplus) : "–"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}
