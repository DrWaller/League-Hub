import { ImageResponse } from "next/og";
import { loadGraphicFonts, getFontFamilies } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { TIER_STYLE } from "./tier-style";
import type { AssessedPick } from "./draft-assessment";

// One draft pick as a shareable card (1080 x 640): tier-coloured, headshot, name, season avg / total / GP / tier and,
// for drafted picks, a navy "vs slot" strip. Satori: every element with more than one child needs display:flex.

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderDraftPick(opts: { pick: AssessedPick; footer?: string; hasHeadshot: boolean }) {
  const p = opts.pick;
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const white = p.tier === "Superstar";
  const s = p.tier ? { bg: TIER_STYLE[p.tier].bg, fg: white ? "#FFFFFF" : TIER_STYLE[p.tier].fg } : { bg: "#2B4560", fg: "#C9D6E6" };
  const shadow = white ? "0 2px 3px rgba(60,40,0,0.45)" : "none";
  const g = p.perTeamGame != null;
  const avg = g ? p.perTeamGame : p.avg;
  const nameSize = fit(560, p.name.length, 40, 76);
  const sub = `${p.nhl ? `${p.nhl} · ` : ""}${p.position} · ${p.team}`;
  const subSize = fit(640, sub.length, 22, 32);
  const stat = (label: string, value: string, note?: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, flexBasis: 0, padding: "12px 0", borderRadius: 16, background: "rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", fontFamily: display, fontSize: 24, letterSpacing: 3, opacity: 0.9 }}>{label}</div>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 56, lineHeight: 1.05 }}>{value}</div>
      <div style={{ display: "flex", fontSize: 22, opacity: 0.9, height: 26 }}>{note ?? ""}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 640, display: "flex", flexDirection: "column", background: s.bg, color: s.fg, textShadow: shadow, fontFamily: body }}>
        <div style={{ display: "flex", alignItems: "center", flexGrow: 1, padding: "34px 44px 10px 44px", gap: 36 }}>
          <PlayerAvatar name={p.name} src={p.playerId != null ? headshotUrl(p.playerId) : ""} hasHeadshot={opts.hasHeadshot} size={250} fontFamily={display} fontSize={90} border="6px solid rgba(255,255,255,0.8)" />
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, gap: 10 }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: 30, letterSpacing: 4, opacity: 0.9 }}>{p.keeper ? "KEEPER" : `PICK ${p.overall}${p.round != null ? ` · ROUND ${p.round}` : ""}`}</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.02, whiteSpace: "nowrap" }}>{p.name}</div>
            <div style={{ display: "flex", fontSize: subSize, whiteSpace: "nowrap" }}>{sub}</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: 5, textTransform: "uppercase", marginTop: 6 }}>{p.tier ?? "Not placed"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, padding: "0 44px" }}>
          {stat("SEASON", f2(avg), g ? "per team game" : "avg pts/game")}
          {stat("TOTAL", f2(p.total), "pts")}
          {stat("VOR", f2(p.vor), "season")}
          {stat("GP", p.gp != null ? String(p.gp) : "–", "played")}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, height: 84, padding: "0 44px", background: "#0C2740", color: "#FFFFFF", textShadow: "none" }}>
          {p.surplus != null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 26, letterSpacing: 3, color: "#9FB3C8" }}>VS SLOT</div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 52, color: p.surplus >= 0 ? "#7BE0A0" : "#FF8FA0" }}>{signed(p.surplus)}</div>
              <div style={{ display: "flex", fontSize: 24, color: "#C9D6E6" }}>{`now #${p.finish ?? "–"} · par ${f2(p.par)}`}</div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 24, color: "#C9D6E6" }}>Keeper (not assessed vs slot)</div>
          )}
          <div style={{ display: "flex", fontFamily: display, fontSize: 22, letterSpacing: 2, color: "#9FB3C8" }}>{opts.footer ?? ""}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 640, fonts, headers: NO_CACHE }
  );
}
