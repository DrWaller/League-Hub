import { ImageResponse } from "next/og";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { shade } from "./nhl-colors";
import type { AllTimePlayer, AllTimeTeamCardData } from "./all-time-team-card";

// All-time team graphic (4:5): the manager's all-star first and second teams as two lineups, in the team's colours.

const W = 1080;
const H = 1350;

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
  const trim = isHex(d.accent) ? d.accent! : lighten(c1, 0.35);
  const accent = isHex(d.accent) ? d.accent! : lighten(c1, 0.6);
  // Three roles: the team colour (header, outline), the accent, and a panel colour that differs from the team colour so the
  // lineup stands out. The panel is navy unless the team has a dark colour of its own (see team-look.ts).
  const panelBase = isHex(d.panel) ? d.panel! : "#10243B";
  const panelTop = panelBase;
  const panelBottom = shade(panelBase, 0.4);
  const soft = lighten(panelBase, 0.72);
  const headerSoft = lighten(c1, 0.8);
  const dim = "rgba(255,255,255,0.4)";
  const dimName = "rgba(255,255,255,0.35)";
  const bg = `linear-gradient(160deg, ${shade(c1, 0.78)} 0%, ${shade(c1, 0.92)} 100%)`;
  const initials = (d.team ?? d.managerName).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 3).join("").toUpperCase();

  const fit = (p: AllTimePlayer | null, inner: number) => (p ? Math.max(26, Math.min(46, Math.floor(inner / (p.name.length * 0.56)))) : 44);
  const pts = (n: number) => Math.round(n).toLocaleString("en-US");

  // One cell: position and points on the top line, the name (the same size across a row) and the seasons below.
  const cell = (pos: string, p: AllTimePlayer | null, size: number) => (
    <div key={pos + (p?.name ?? "")} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: 174, flexShrink: 0, overflow: "hidden", padding: "10px 16px 12px 16px", borderRadius: 14, border: `1px solid ${p ? accent : dim}`, background: p ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", height: 40 }}>
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: 4, color: p ? accent : dim }}>{pos}</div>
        {p ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1, color: accent }}>{pts(p.points)}</div> : null}
      </div>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: p ? size : 30, lineHeight: 1.2, height: 64, alignItems: "center", color: p ? "#FFFFFF" : dimName, whiteSpace: "nowrap" }}>{p ? p.name.toUpperCase().slice(0, 24) : "OPEN SPOT"}</div>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 600, lineHeight: 1, color: soft }}>{p ? `${p.seasons} season${p.seasons === 1 ? "" : "s"}` : ""}</div>
    </div>
  );

  const INNER = 262;
  const row = (cells: [string, AllTimePlayer | null][]) => {
    const size = Math.min(...cells.map(([, p]) => fit(p, INNER)));
    return (
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>{cells.map(([pos, p]) => cell(pos, p, size))}</div>
    );
  };

  const panel = (title: string, t: AllTimeTeamCardData["teams"][number]) => {
    const sub = [t.LW, t.C, t.RW, t.D[0], t.D[1], t.G].reduce((n, p) => n + (p?.points ?? 0), 0);
    return (
      <div key={title} style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "16px 24px 24px 24px", borderRadius: 22, border: `4px solid ${trim}`, backgroundImage: `linear-gradient(170deg, ${panelTop} 0%, ${panelBottom} 100%)` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", height: 44, flexShrink: 0 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 36, lineHeight: 1, letterSpacing: 6, color: "#FFFFFF" }}>{title}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 28, lineHeight: 1, letterSpacing: 3, color: accent }}>{`${pts(sub)} PTS`}</div>
        </div>
        {row([["LW", t.LW], ["C", t.C], ["RW", t.RW]])}
        {row([["D", t.D[0]], ["G", t.G], ["D", t.D[1]]])}
      </div>
    );
  };

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 30, backgroundImage: bg, fontFamily: body }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, height: 220, padding: "0 28px", borderRadius: 22, border: `9px solid ${trim}`, backgroundImage: `linear-gradient(165deg, ${c1} 0%, ${shade(c1, 0.55)} 100%)` }}>
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og JSX
            <img src={d.logo} width={140} height={140} style={{ width: 140, height: 140, objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", width: 140, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 90, color: "rgba(255,255,255,0.88)" }}>{initials}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, lineHeight: 1.1, letterSpacing: 8, color: accent }}>ALL-TIME TEAM</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: d.managerName.length > 14 ? 60 : 76, lineHeight: 1.1, color: "#FFFFFF", textTransform: "uppercase", whiteSpace: "nowrap" }}>{d.managerName.slice(0, 22)}</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 28, lineHeight: 1.1, letterSpacing: 3, color: headerSoft, textTransform: "uppercase", whiteSpace: "nowrap" }}>{(d.team ?? "").slice(0, 26)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF" }}>{pts(d.total)}</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, lineHeight: 1.1, letterSpacing: 4, color: accent }}>TOTAL POINTS</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 18, marginTop: 18 }}>
          {panel("FIRST TEAM", d.teams[0])}
          {panel("SECOND TEAM", d.teams[1])}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "10px 6px 0 6px", fontFamily: display, fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: 2, color: accent }}>
          <div style={{ display: "flex" }}>{d.leagueName.toUpperCase().slice(0, 40)}</div>
          <div style={{ display: "flex" }}>ESTIMATED FROM WEEKLY ROSTERS, ESPN SEASONS</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}
