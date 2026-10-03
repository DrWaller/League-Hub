import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { RadarAxis } from "./radar";

// Player Radar card (portrait). A hero row (big headshot, name, key totals), then
// the percentile radar on a navy panel with a
// gold shape (the shape is the PLAYER, so it never shares a color with the
// good/bad number colors). The chart is inline SVG; its labels are normal
// elements placed around it because Satori doesn't render text inside SVG.

const GOLD = "#E0AE4A";
const GOOD = "#5ED69A"; // on navy
const BAD = "#FF8195"; // on navy
const SOFT = "#9FB6CD";

const PW = 984; // panel width
const PH = 820; // panel height
const CX = PW / 2;
const CY = 392;
const R = 258; // radius of the 100th-percentile ring
const LABEL_R = 314; // distance of the label centres
const LABEL_W = 150;
const LABEL_H = 80;

const point = (i: number, n: number, radius: number) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n; // start at the top, go clockwise
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
};
const polygon = (n: number, radius: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => {
    const p = point(i, n, radius(i));
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

const pctColor = (pct: number) => (pct >= 75 ? GOOD : pct <= 25 ? BAD : "#FFFFFF");
const marker = (pct: number) => (pct >= 75 ? "\u25B2" : pct <= 25 ? "\u25BC" : "");

export function formatValue(a: RadarAxis): string {
  if (a.label === "SV%") return a.value > 1 ? a.value.toFixed(1) : a.value.toFixed(3).replace(/^0/, "");
  if (a.rate) return a.value.toFixed(2);
  return `${a.value.toFixed(2)}/gm`;
}

export async function renderPortraitRadar(opts: {
  footer?: string;
  subtitle?: string;
  playerId: number;
  name: string;
  position: string;
  teamName: string;
  hasHeadshot: boolean;
  axes: RadarAxis[];
  chips: { label: string; value: string }[];
  note: string; // e.g. "Ranked vs 312 NHL forwards - per game - min 3 GP"
  smallSample?: string; // e.g. "SMALL SAMPLE - 2 GP"
}) {
  const { axes } = opts;
  const n = axes.length;

  return frame({
    footer: opts.footer,
    title: "Player Radar",
    subtitle: opts.subtitle ?? "Season to date",
    plain: true,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 14 }}>
        {/* hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, height: 204, flexShrink: 0 }}>
          <PlayerAvatar name={opts.name} src={headshotUrl(opts.playerId)} hasHeadshot={opts.hasHeadshot} size={196} fontFamily={display} fontSize={68} border={`7px solid ${GOLD}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: 62, fontWeight: 700, lineHeight: 1.04, color: OG.board, maxWidth: 740, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{opts.name}</div>
            <div style={{ display: "flex", fontSize: 30, color: OG.muted, maxWidth: 740, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{`${opts.position} \u00b7 ${opts.teamName}`}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {opts.chips.map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "baseline", gap: 8, background: OG.rink, borderRadius: 10, padding: "6px 16px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: "#FFFFFF" }}>{c.value}</div>
                  <div style={{ display: "flex", fontSize: 19, fontWeight: 600, letterSpacing: 1, color: "#C9D6E6" }}>{c.label}</div>
                </div>
              ))}
              {opts.smallSample ? (
                <div style={{ display: "flex", alignItems: "center", background: "#FFF1CF", border: `2px solid ${GOLD}`, borderRadius: 10, padding: "6px 14px", fontSize: 19, fontWeight: 700, letterSpacing: 1, color: OG.goldText }}>{opts.smallSample}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* radar panel */}
        <div style={{ display: "flex", position: "relative", width: PW, height: PH, flexShrink: 0, borderRadius: 26, backgroundImage: "linear-gradient(160deg, #16406B 0%, #0C2740 100%)", overflow: "hidden" }}>
          <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{ position: "absolute", left: 0, top: 0 }}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <polygon key={f} points={polygon(n, () => R * f)} fill={f === 1 ? "rgba(255,255,255,0.06)" : "none"} stroke={f === 0.5 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.20)"} strokeWidth={f === 0.5 ? 3 : 2} strokeDasharray={f === 0.5 ? "10 8" : undefined} />
            ))}
            {axes.map((_, i) => {
              const p = point(i, n, R);
              return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.14)" strokeWidth={2} />;
            })}
            <polygon points={polygon(n, (i) => Math.max(0.02, axes[i].pct / 100) * R)} fill="rgba(224,174,74,0.38)" stroke={GOLD} strokeWidth={5} strokeLinejoin="round" />
            {axes.map((a, i) => {
              const p = point(i, n, Math.max(0.02, a.pct / 100) * R);
              return <circle key={i} cx={p.x} cy={p.y} r={8} fill={GOLD} stroke="#FFFFFF" strokeWidth={3} />;
            })}
          </svg>
          {/* the dashed ring is labelled on the chart itself */}
          <div style={{ position: "absolute", left: CX + 10, top: CY - R * 0.5 - 4, display: "flex", fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.7)" }}>AVG</div>
          {axes.map((a, i) => {
            const p = point(i, n, LABEL_R);
            return (
              <div key={a.statId} style={{ position: "absolute", left: p.x - LABEL_W / 2, top: p.y - LABEL_H / 2, width: LABEL_W, height: LABEL_H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 27, fontWeight: 700, letterSpacing: 1, color: "#C9D6E6", lineHeight: 1 }}>{a.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 46, fontWeight: 700, color: pctColor(a.pct), lineHeight: 1.05 }}>{String(Math.round(a.pct))}</div>
                  {marker(a.pct) ? <div style={{ display: "flex", fontSize: 18, color: pctColor(a.pct) }}>{marker(a.pct)}</div> : null}
                </div>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, bottom: 16, width: PW, display: "flex", justifyContent: "center", fontSize: 21, color: SOFT }}>{opts.note}</div>
        </div>
      </div>
    ),
  });
}
