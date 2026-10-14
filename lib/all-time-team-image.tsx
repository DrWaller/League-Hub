import { ImageResponse } from "next/og";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { shade } from "./nhl-colors";
import type { AllTimePlayer, AllTimeTeamCardData } from "./all-time-team-card";

// All-time team graphic (4:5): the manager's all-star first and second teams as two lineups, in the team's colours.

const W = 1080;
const H = 1350;
const INK = "#10243B";

const lighten = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * a);
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
};
const isHex = (v?: string) => Boolean(v && /^#[0-9a-f]{6}$/i.test(v));

export async function renderAllTimeTeam(d: AllTimeTeamCardData) {
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const c1 = isHex(d.primary) ? d.primary! : "#123A61";
  const trim = lighten(c1, 0.35);
  const accent = lighten(c1, 0.6);
  const bg = `linear-gradient(160deg, ${shade(c1, 0.78)} 0%, ${shade(c1, 0.92)} 100%)`;
  const initials = (d.team ?? d.managerName).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 3).join("").toUpperCase();

  // inner = the room for a name in pixels; the type shrinks so a long name still fits its box.
  const cell = (pos: string, p: AllTimePlayer | null, inner: number) => {
    const name = p ? p.name.toUpperCase().slice(0, 24) : "OPEN SPOT";
    const size = p ? Math.max(24, Math.min(42, Math.floor(inner / (name.length * 0.56)))) : 28;
    return (
      <div key={pos + (p?.name ?? "")} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: 124, flexShrink: 0, overflow: "hidden", padding: "10px 16px 12px 16px", borderRadius: 14, border: `1px solid ${p ? accent : "#2A4767"}`, background: p ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 4, color: p ? accent : "#6C88A5" }}>{pos}</div>
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: size, lineHeight: 1.2, height: 50, alignItems: "center", color: p ? "#FFFFFF" : "#4F6A86", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ display: "flex", fontSize: 21, fontWeight: 600, color: "#9FB6CD", height: 26 }}>
          {p ? `${Math.round(p.points).toLocaleString("en-US")} pts, ${p.seasons} season${p.seasons === 1 ? "" : "s"}` : ""}
        </div>
      </div>
    );
  };

  const panel = (title: string, t: AllTimeTeamCardData["teams"][number]) => (
    <div key={title} style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "16px 24px 20px 24px", borderRadius: 22, border: `4px solid ${trim}`, backgroundImage: `linear-gradient(170deg, ${INK} 0%, #0A1828 100%)` }}>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, lineHeight: 1, height: 40, flexShrink: 0, letterSpacing: 6, color: accent, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", gap: 12 }}>{[cell("LW", t.LW, 272), cell("C", t.C, 272), cell("RW", t.RW, 272)]}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>{[cell("D", t.D[0], 430), cell("D", t.D[1], 430)]}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={{ display: "flex", flex: 1 }} />
        {cell("G", t.G, 272)}
        <div style={{ display: "flex", flex: 1 }} />
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 30, backgroundImage: bg, fontFamily: body }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, height: 200, padding: "0 28px", borderRadius: 22, border: `9px solid ${trim}`, backgroundImage: `linear-gradient(165deg, ${c1} 0%, ${shade(c1, 0.55)} 100%)` }}>
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og JSX
            <img src={d.logo} width={140} height={140} style={{ width: 140, height: 140, objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", width: 140, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 90, color: "rgba(255,255,255,0.88)" }}>{initials}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 28, lineHeight: 1.1, letterSpacing: 8, color: accent }}>ALL-TIME TEAM</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: d.managerName.length > 14 ? 60 : 76, lineHeight: 1.1, color: "#FFFFFF", textTransform: "uppercase", whiteSpace: "nowrap" }}>{d.managerName.slice(0, 22)}</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, lineHeight: 1.1, letterSpacing: 3, color: "#C9D6E6", textTransform: "uppercase", whiteSpace: "nowrap" }}>{(d.team ?? "").slice(0, 30)}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 18, marginTop: 18 }}>
          {panel("FIRST TEAM", d.teams[0])}
          {panel("SECOND TEAM", d.teams[1])}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, padding: "8px 6px 0 6px", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 2, color: accent }}>
          <div style={{ display: "flex" }}>{d.leagueName.toUpperCase().slice(0, 40)}</div>
          <div style={{ display: "flex" }}>{`${Math.round(d.total).toLocaleString("en-US")} PTS (ESTIMATED), ESPN SEASONS`}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}
