import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
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
const PH = 680; // panel height
const CX = PW / 2;
const CY = 326;
const R = 212; // radius of the 100th-percentile ring
const LABEL_R = 276; // distance of the label centres
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


// Fantasy points: the totals lead; the comparison (rank big, percentile small) is a supporting number.
export function PointsTable({ points, positionLabel, display, mode }: { points: PointsComparison; positionLabel?: string; display: string; mode: "pct" | "rank" | "both" | "rankpct" }) {
  const modeName = mode === "rank" ? "RANK" : mode === "both" ? "PCTL / RANK" : mode === "rankpct" ? "RANK / PCTL" : "PERCENTILE";
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, background: "#FFFFFF", border: "1px solid #BCD5EA", borderRadius: 14, boxShadow: "0 6px 16px rgba(18,58,97,0.10)" }}>
            <div style={{ display: "flex", alignItems: "center", height: 30, padding: "0 20px", borderBottom: "1px solid #BCD5EA" }}>
              <div style={{ display: "flex", width: 330, fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 3, color: OG.muted }}>FANTASY POINTS</div>
              <div style={{ display: "flex", flex: 1, fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: OG.muted }}>{`ALL PLAYERS \u00b7 ${modeName}`}</div>
              <div style={{ display: "flex", flex: 1, fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: OG.muted }}>{`${positionLabel ?? "POSITION"} \u00b7 ${modeName}`}</div>
            </div>
            {[
              { name: "TOTAL", line: points.total, fmt: (v: number) => v.toFixed(1) },
              { name: "AVG / GAME", line: points.avg, fmt: (v: number) => v.toFixed(2) },
            ].map((r, i) => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", height: 60, padding: "0 20px", borderTop: i === 0 ? "none" : "1px solid #E1ECF6" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, width: 330 }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 50, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{r.fmt(r.line.value)}</div>
                  <div style={{ display: "flex", fontSize: 20, fontWeight: 600, letterSpacing: 1, color: OG.muted }}>{r.name}</div>
                </div>
                {[r.line.all, r.line.position].map((st: Standing, k) => (
                  <div key={k} style={{ display: "flex", flex: 1, alignItems: "baseline", gap: 8 }}>
                    {mode === "rank" || mode === "rankpct" ? (
                      <div style={{ display: "flex", fontFamily: display, fontSize: 30, fontWeight: 700, lineHeight: 1, color: "#3F5E7D" }}>{`#${st.rank}`}</div>
                    ) : (
                      <div style={{ display: "flex", fontFamily: display, fontSize: 30, fontWeight: 700, lineHeight: 1, color: pctOnLight(st.pct) }}>{String(Math.round(st.pct))}</div>
                    )}
                    {mode === "pct" ? null : mode === "rankpct" ? (
                      <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: pctOnLight(st.pct) }}>{`${Math.round(st.pct)}th pct`}</div>
                    ) : (
                      <div style={{ display: "flex", fontSize: 18, color: OG.muted }}>{mode === "rank" ? `of ${st.of}` : `#${st.rank} of ${st.of}`}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
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
  axes: RadarAxis[];
  counts?: { label: string; value: string }[]; // rare stats shown as season totals instead of percentiles
  chips: { label: string; value: string }[];
  points?: PointsComparison;
  positionLabel?: string; // column title for the position comparison, e.g. "FORWARDS"
  pointsDisplay?: "pct" | "rank" | "both" | "rankpct"; // default rankpct = rank big + percentile small (no pool size); the others are available via ?pts=
  note: string; // e.g. "Ranked vs 312 NHL forwards - per game - min 3 GP"
  qualified?: boolean; // false = below the minimum games: the shape and numbers are dimmed
  smallSample?: string; // e.g. "NOT QUALIFIED - 2 of 3 GP"
}) {
  const { axes } = opts;
  const n = axes.length;
  const qualified = opts.qualified !== false;
  const mode = opts.pointsDisplay ?? "rankpct";

  return frame({
    footer: opts.footer,
    title: "Player Radar",
    subtitle: opts.subtitle ?? "Season to date",
    plain: true,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 16 }}>
        {/* hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, height: 176, flexShrink: 0 }}>
          <PlayerAvatar name={opts.name} src={headshotUrl(opts.playerId)} hasHeadshot={opts.hasHeadshot} size={168} fontFamily={display} fontSize={58} border={`7px solid ${GOLD}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: 58, fontWeight: 700, lineHeight: 1.04, color: OG.board, maxWidth: 760, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{opts.name}</div>
            <div style={{ display: "flex", fontSize: 30, color: OG.muted, maxWidth: 740, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{opts.teamName ? `${opts.position} \u00b7 ${opts.teamName}` : opts.position}</div>
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

        {opts.points ? <PointsTable points={opts.points} positionLabel={opts.positionLabel} display={display} mode={mode} /> : null}

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
              {opts.counts.slice(0, 3).map((c) => (
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
