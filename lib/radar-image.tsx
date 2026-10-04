import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { PlayerHeader } from "./player-header";
import { ordinal } from "./format";
import { TIERS, type TierName } from "./tiers";
import { PointsComparison, RadarAxis, Standing, scaleColor } from "./radar";

// Player Radar card (portrait). A hero row (big headshot, name, key totals), then
// the percentile radar on a navy panel with a
// gold shape (the shape is the PLAYER, so it never shares a color with the
// good/bad number colors). The chart is inline SVG; its labels are normal
// elements placed around it because Satori doesn't render text inside SVG.

const GOLD = "#E0AE4A";
const NAVY = "#123A61";
const SOFT = "#9FB6CD";
const pctOnLight = (pct: number) => scaleColor(pct, false);

const PW = 984; // panel width
const PH = 668; // panel height
const CX = PW / 2;
const CY = 321;
const R = 204; // radius of the 100th-percentile ring
const LABEL_R = 267; // distance of the label centres
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

const pctColor = (pct: number) => scaleColor(pct, true);
const marker = (pct: number) => (pct >= 75 ? "\u25B2" : pct <= 25 ? "\u25BC" : "");

export function formatValue(a: RadarAxis): string {
  if (a.label === "SV%") return a.value > 1 ? a.value.toFixed(1) : a.value.toFixed(3).replace(/^0/, "");
  if (a.rate) return a.value.toFixed(2);
  return `${a.value.toFixed(2)}/gm`;
}


// A drawn star: the card font has no star glyph.
function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <polygon points="12,1.5 15,8.6 22.5,9.3 16.8,14.3 18.6,21.8 12,17.8 5.4,21.8 7.2,14.3 1.5,9.3 9,8.6" fill={color} />
    </svg>
  );
}
export function TierPill({ tier, display, size = 24 }: { tier: TierName; display: string; size?: number }) {
  const t = TIERS[tier];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3, backgroundImage: t.bg, color: t.fg, borderRadius: size, padding: `${size * 0.12}px ${size * 0.7}px`, fontFamily: display, fontWeight: 700, fontSize: size, letterSpacing: 3 }}>
      {t.star ? <Star size={size * 0.85} color={t.fg} /> : null}
      <div style={{ display: "flex" }}>{tier.toUpperCase()}</div>
    </div>
  );
}

// Fantasy points as two scoreboard tiles: the total and the per-game average are the hero numbers; rank
// (larger) and percentile (smaller) against all players and against his own group sit underneath.
export function HeroTiles({ points, positionLabel, display, tier }: { points: PointsComparison; positionLabel?: string; display: string; tier?: TierName | null }) {
  const tile = (label: string, value: string, all: Standing, pos: Standing) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, borderRadius: 18, backgroundImage: "linear-gradient(160deg, #16406B 0%, #0C2740 100%)", padding: "16px 12px 16px 12px", boxShadow: "0 6px 16px rgba(18,58,97,0.18)" }}>
      <div style={{ display: "flex", fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: 4, color: GOLD }}>{label}</div>
      <div style={{ display: "flex", fontFamily: display, fontSize: 124, fontWeight: 700, lineHeight: 1.02, color: "#FFFFFF" }}>{value}</div>
      {/* the tier is based on per-game points vs his position, so it sits in the PER GAME tile; both tiles get the same
          fixed-height slot (a red rule, or the tier badge) so their rank lines stay level */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%" }}>
        {tier && label === "PER GAME" ? <TierPill tier={tier} display={display} size={24} /> : <div style={{ display: "flex", width: 140, height: 3, background: "#C41E3A" }} />}
      </div>
      {([["ALL PLAYERS", all], [positionLabel ?? "POSITION", pos]] as [string, Standing][]).map(([l, st]) => (
        <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 3 }}>
          <div style={{ display: "flex", width: 138, fontSize: 18, fontWeight: 600, letterSpacing: 1, color: "#9FB6CD" }}>{l}</div>
          <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, color: "#FFFFFF" }}>{`#${st.rank}`}</div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: scaleColor(st.pct, true) }}>{ordinal(st.pct)}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
      {tile("TOTAL", points.total.value.toFixed(2), points.total.all, points.total.position)}
      {tile("PER GAME", points.avg.value.toFixed(2), points.avg.all, points.avg.position)}
    </div>
  );
}

export async function renderPortraitRadar(opts: {
  footer?: string;
  subtitle?: string;
  playerId: number;
  name: string;
  position: string;
  teamName?: string;
  hasHeadshot: boolean;
  photoUrl?: string;
  axes: RadarAxis[];
  counts?: { label: string; value: string }[]; // rare stats shown as season totals instead of percentiles
  gp: number;
  points?: PointsComparison;
  positionLabel?: string; // column title for the position comparison, e.g. "FORWARDS"
  tier?: TierName | null; // per-game tier vs his position group (null / absent = not shown)
  note: string; // e.g. "Ranked vs 312 NHL forwards - per game - min 3 GP"
  qualified?: boolean; // false = below the minimum games: the shape and numbers are dimmed
  smallSample?: string; // e.g. "NOT QUALIFIED - 2 of 3 GP"
}) {
  const { axes } = opts;
  const n = axes.length;
  const qualified = opts.qualified !== false;

  return frame({
    footer: opts.footer,
    title: "",
    subtitle: "",
    plain: true,
    headerContent: ({ display }) => (
      <PlayerHeader display={display} playerId={opts.playerId} name={opts.name} position={opts.position} teamName={opts.teamName} hasHeadshot={opts.hasHeadshot} photoUrl={opts.photoUrl} subtitle={opts.subtitle ?? "Season to date"} gp={opts.gp} notQualified={opts.smallSample} />
    ),
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 16 }}>
        {opts.points ? <HeroTiles points={opts.points} positionLabel={opts.positionLabel} display={display} tier={opts.tier} /> : null}

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
            <polygon points={polygon(n, (i) => Math.max(0.02, axes[i].pct / 100) * R)} fill={qualified ? "rgba(224,174,74,0.38)" : "rgba(224,174,74,0.14)"} stroke={GOLD} strokeWidth={5} strokeLinejoin="round" strokeDasharray={qualified ? undefined : "16 10"} />
            {axes.map((a, i) => {
              const p = point(i, n, Math.max(0.02, a.pct / 100) * R);
              return <circle key={i} cx={p.x} cy={p.y} r={8} fill={GOLD} stroke="#FFFFFF" strokeWidth={3} />;
            })}
          </svg>
          {opts.counts && opts.counts.length > 0 ? (
            <div style={{ position: "absolute", left: 18, top: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {opts.counts.slice(0, 4).map((c) => (
                <div key={c.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96, padding: "6px 0", borderRadius: 10, background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.22)" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 36, fontWeight: 700, lineHeight: 1.05, color: "#FFFFFF" }}>{c.value}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#C9D6E6" }}>{c.label}</div>
                </div>
              ))}
            </div>
          ) : null}
          {/* the dashed ring is labelled on the chart itself */}
          <div style={{ position: "absolute", left: CX + 10, top: CY - R * 0.5 - 4, display: "flex", fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.7)" }}>MEDIAN</div>
          {axes.map((a, i) => {
            const p = point(i, n, LABEL_R);
            return (
              <div key={a.statId} style={{ position: "absolute", left: p.x - LABEL_W / 2, top: p.y - LABEL_H / 2, width: LABEL_W, height: LABEL_H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: qualified ? 1 : 0.55 }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 27, fontWeight: 700, letterSpacing: 1, color: "#C9D6E6", lineHeight: 1 }}>{a.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 46, fontWeight: 700, color: pctColor(a.pct), lineHeight: 1.05 }}>{String(Math.round(a.pct))}</div>
                  {marker(a.pct) ? <div style={{ display: "flex", fontSize: 18, color: pctColor(a.pct) }}>{marker(a.pct)}</div> : null}
                </div>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, bottom: 10, width: PW, display: "flex", justifyContent: "center", fontSize: 21, color: SOFT }}>{opts.note}</div>
        </div>
      </div>
    ),
  });
}
