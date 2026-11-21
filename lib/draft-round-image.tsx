import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { TIER_STYLE } from "./tier-style";
import type { AssessedPick } from "./draft-assessment";

// One portrait (1080 x 1350) graphic for one draft round: every pick in order as a full-width row filled in its tier
// colour, with headshot, player and team, season avg, season total and tier. Satori rules: every element with more
// than one child needs display:flex, so each text is a single string.

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));
const GAP = 14;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderDraftRound(opts: { round: number; picks: AssessedPick[]; footer?: string; headshots?: Set<number>; keepers?: boolean; title?: string; subtitle?: string; labels?: Map<number, string>; hideTeam?: boolean }) {
  const headshots = opts.headshots ?? new Set<number>();
  const n = Math.max(1, opts.picks.length);
  // Keepers aren't draft picks: no pick number, and with only a few rows everything is drawn larger so it reads on a phone.
  const nopk = !!opts.keepers;
  // Long lists with no subtitle (a team's 14 picks) get a shorter header and tighter gaps so the rows can be taller.
  const compact = n > 10 && !opts.subtitle;
  const rowGap = compact ? 6 : 8;
  const rowH = Math.min(nopk ? 140 : 104, Math.floor(((compact ? 1160 : 1094) - 24 - 40 - (n - 1) * rowGap) / n));
  // Text scale: bigger for the few keeper rows, a bit smaller when many rows share the page (a team has 14 picks).
  const k = nopk ? Math.min(1.3, rowH / 104) : Math.min(1, 0.62 + rowH / 260);
  const W_AVG = Math.round(130 * k);
  const W_TOT = Math.round(130 * k);
  const W_TIER = Math.round(170 * k);
  const avatar = Math.min(Math.round(76 * k), rowH - 14);
  const pkW = nopk ? 0 : 60;
  const gaps = nopk ? 4 : 5;
  return frame({
    dark: true,
    flush: true,
    compactHeader: compact,
    footer: opts.footer,
    title: opts.title ?? (opts.keepers ? "Draft Keepers" : `Draft Round ${opts.round}`),
    subtitle: opts.subtitle ?? "",
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 40, gap: GAP, padding: "0 18px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          {nopk ? null : <div style={{ display: "flex", width: 60, justifyContent: "center" }}>PK</div>}
          <div style={{ display: "flex", flexGrow: 1, paddingLeft: avatar + GAP }}>PLAYER</div>
          <div style={{ display: "flex", width: W_AVG, justifyContent: "flex-end" }}>AVG</div>
          <div style={{ display: "flex", width: W_TOT, justifyContent: "flex-end" }}>TOTAL</div>
          <div style={{ display: "flex", width: W_TIER, justifyContent: "flex-end" }}>TIER</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
          {opts.picks.map((p) => {
            const gold = p.tier === "Superstar";
            // Gold rows get solid white text at full strength (no fading) with a faint shadow, like the Tier Lists cards.
            const s = gold ? { bg: TIER_STYLE.Superstar.bg, fg: "#FFFFFF" } : p.tier ? TIER_STYLE[p.tier] : { bg: "#2B4560", fg: "#C9D6E6" };
            const o = (x: number) => (gold ? 1 : x);
            const room = 1024 - 36 - pkW - avatar - W_AVG - W_TOT - W_TIER - GAP * gaps;
            const name = p.name;
            const nameSize = fit(room, name.length, Math.round(22 * Math.min(k, 1)), Math.round(38 * k));
            const tag = opts.labels?.get(p.overall);
            const subText = [p.position, opts.hideTeam ? null : p.team, p.gp != null ? `${p.gp} GP` : null, tag ?? null].filter(Boolean).join(" · ");
            const subSize = fit(room * 1.6, subText.length, Math.round(17 * Math.min(k, 1)), Math.round(22 * k));
            const avg = p.perTeamGame != null ? p.perTeamGame : p.avg;
            return (
              <div key={p.overall} style={{ display: "flex", alignItems: "center", gap: GAP, height: rowH, flexShrink: 0, padding: "0 18px", borderRadius: 14, background: s.bg, color: s.fg, textShadow: gold ? "0 2px 3px rgba(60,40,0,0.45)" : "none" }}>
                {nopk ? null : <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1, opacity: o(0.85) }}>{String(p.overall)}</div>}
                <PlayerAvatar name={p.name} src={p.playerId != null ? headshotUrl(p.playerId) : ""} hasHeadshot={p.playerId != null && headshots.has(p.playerId)} size={avatar} fontFamily={display} fontSize={Math.round(avatar * 0.36)} border="3px solid rgba(255,255,255,0.7)" />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ display: "flex", fontSize: subSize, lineHeight: 1.1, opacity: o(0.88), fontWeight: gold ? 600 : 400, whiteSpace: "nowrap" }}>{subText}</div>
                </div>
                <div style={{ display: "flex", width: W_AVG, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: Math.round(44 * k), lineHeight: 1 }}>{f2(avg)}</div>
                <div style={{ display: "flex", width: W_TOT, justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: Math.round(32 * k), lineHeight: 1, opacity: o(0.9) }}>{f2(p.total)}</div>
                <div style={{ display: "flex", width: W_TIER, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: Math.round(24 * k), letterSpacing: 2, textTransform: "uppercase" }}>{p.tier ?? "N/A"}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}
