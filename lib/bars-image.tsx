import { OG } from "./og-theme";
import { frame } from "./portrait-graphics";
import { PlayerHeader } from "./player-header";
import { Group, PointsComparison, RadarAxis, scaleColor, sectionOf } from "./radar";
import type { TierName } from "./tiers";
import { HeroTiles, formatValue } from "./radar-image";

// Player Bars card (portrait): the same data as the radar, drawn like Baseball Savant's
// percentile panel -- one bar per category on a shared scale, a numbered circle at the end of
// each bar, the actual per-game value on the right, categories grouped into sections.
// A player below the games minimum gets hatched bars with no percentiles ("NOT QUALIFIED").

const GOLD = "#E0AE4A";
const NAVY = "#123A61";

const PW = 984; // panel width
const PAD = 22;
const LABEL_W = 150;
const TRACK_W = 590;
const VALUE_W = PW - PAD * 2 - LABEL_W - TRACK_W - 28; // 28 = two 14px gaps
const CIRCLE = 46;
// Diagonal hatching built from hard color stops (Satori has no repeating gradients).
const HATCH = (() => {
  const stripes = 44;
  const stops: string[] = [];
  for (let i = 0; i < stripes; i++) {
    const color = i % 2 === 0 ? "#C3D1E0" : "#E9F0F7";
    stops.push(`${color} ${((i / stripes) * 100).toFixed(2)}%`, `${color} ${(((i + 1) / stripes) * 100).toFixed(2)}%`);
  }
  return `linear-gradient(135deg, ${stops.join(", ")})`;
})();

export async function renderPortraitBars(opts: {
  footer?: string;
  subtitle?: string;
  playerId: number;
  name: string;
  position: string;
  teamName?: string;
  hasHeadshot: boolean;
  photoUrl?: string;
  group: Group;
  axes: RadarAxis[];
  counts?: { label: string; value: string }[];
  gp: number;
  points?: PointsComparison;
  positionLabel?: string;
  tier?: TierName | null;
  note: string;
  qualified?: boolean;
  smallSample?: string;
}) {
  const qualified = opts.qualified !== false;
  const counts = opts.counts ?? [];

  // Group the categories into sections, keeping the chart order.
  const sections: { name: string; axes: RadarAxis[] }[] = [];
  for (const a of opts.axes) {
    const name = sectionOf(a.statId, opts.group);
    const found = sections.find((x) => x.name === name);
    if (found) found.axes.push(a);
    else sections.push({ name, axes: [a] });
  }

  // Row height from the space available; a card with few rows (goalies) gets bigger rows and a
  // shorter panel, and the stack is centered on the card instead of leaving gaps inside the panel.
  const PANEL_MAX = opts.points ? 650 : 1020;
  const fixed = 34 /* scale labels */ + sections.length * 40 + (counts.length ? 66 : 0) + (qualified ? 0 : 52) + 34 /* note */ + 34 /* padding */;
  const rowH = Math.max(46, Math.min(116, Math.floor((PANEL_MAX - fixed) / Math.max(1, opts.axes.length))));
  const PANEL_H = Math.min(PANEL_MAX, fixed + opts.axes.length * rowH + 10);
  const barH = Math.min(56, Math.round(rowH * 0.56));

  return frame({
    footer: opts.footer,
    title: "",
    subtitle: "",
    plain: true,
    headerContent: ({ display }) => (
      <PlayerHeader display={display} playerId={opts.playerId} name={opts.name} position={opts.position} teamName={opts.teamName} hasHeadshot={opts.hasHeadshot} photoUrl={opts.photoUrl} subtitle={opts.subtitle ?? "Season to date"} gp={opts.gp} notQualified={opts.smallSample} />
    ),
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 16, justifyContent: "center" }}>
        {opts.points ? <HeroTiles points={opts.points} positionLabel={opts.positionLabel} display={display} tier={opts.tier} /> : null}

        {/* the bars panel */}
        <div style={{ display: "flex", flexDirection: "column", width: PW, height: PANEL_H, flexShrink: 0, background: "#FFFFFF", border: "1px solid #BCD5EA", borderRadius: 18, boxShadow: "0 6px 16px rgba(18,58,97,0.10)", padding: `14px ${PAD}px 10px ${PAD}px` }}>
          {/* scale */}
          <div style={{ display: "flex", height: 34, alignItems: "center" }}>
            <div style={{ display: "flex", width: LABEL_W + 14, flexShrink: 0 }} />
            <div style={{ display: "flex", position: "relative", width: TRACK_W, height: 34 }}>
              <div style={{ position: "absolute", left: 0, top: 6, display: "flex", fontFamily: display, fontSize: 17, fontWeight: 700, letterSpacing: 3, color: scaleColor(10, false) }}>POOR</div>
              <div style={{ position: "absolute", left: TRACK_W / 2 - 40, top: 6, width: 80, display: "flex", justifyContent: "center", fontFamily: display, fontSize: 17, fontWeight: 700, letterSpacing: 3, color: OG.muted }}>MEDIAN</div>
              <div style={{ position: "absolute", right: 0, top: 6, display: "flex", fontFamily: display, fontSize: 17, fontWeight: 700, letterSpacing: 3, color: scaleColor(95, false) }}>GREAT</div>
            </div>
          </div>

          {!qualified ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, marginBottom: 8, borderRadius: 8, background: "#EEF3F9", fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: 3, color: OG.muted }}>
              {`NOT QUALIFIED \u00b7 PERCENTILES HIDDEN`}
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
            {sections.map((sec) => (
              <div key={sec.name} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-end", height: 40, paddingBottom: 4, borderBottom: "3px solid #BCD5EA", marginBottom: 4 }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 23, fontWeight: 700, letterSpacing: 3, color: NAVY }}>{sec.name}</div>
                </div>
                {sec.axes.map((a) => {
                  const fillW = Math.max(10, Math.round((a.pct / 100) * TRACK_W));
                  const color = scaleColor(a.pct, false);
                  return (
                    <div key={a.statId} style={{ display: "flex", alignItems: "center", height: rowH }}>
                      <div style={{ display: "flex", width: LABEL_W, justifyContent: "flex-end", fontFamily: display, fontSize: 28, fontWeight: 700, color: NAVY }}>{a.label}</div>
                      <div style={{ display: "flex", position: "relative", width: TRACK_W, height: barH, margin: "0 14px", flexShrink: 0 }}>
                        <div style={{ position: "absolute", left: 0, top: 0, width: TRACK_W, height: barH, display: "flex", borderRadius: barH / 2, background: "#E4EDF6" }} />
                        {qualified ? (
                          <div style={{ position: "absolute", left: 0, top: 0, width: fillW, height: barH, display: "flex", borderRadius: barH / 2, background: color }} />
                        ) : (
                          <div style={{ position: "absolute", left: 0, top: 0, width: TRACK_W, height: barH, display: "flex", borderRadius: barH / 2, backgroundImage: HATCH }} />
                        )}
                        <div style={{ position: "absolute", left: TRACK_W / 2 - 1, top: -4, width: 3, height: barH + 8, display: "flex", background: "rgba(18,58,97,0.30)" }} />
                        {qualified ? (
                          <div
                            style={{
                              position: "absolute", left: Math.max(0, Math.min(TRACK_W - CIRCLE, fillW - CIRCLE / 2)), top: (barH - CIRCLE) / 2,
                              width: CIRCLE, height: CIRCLE, display: "flex", alignItems: "center", justifyContent: "center",
                              borderRadius: CIRCLE / 2, background: color, border: "3px solid #FFFFFF", fontFamily: display, fontSize: 23, fontWeight: 700, color: "#FFFFFF",
                            }}
                          >
                            {String(Math.round(a.pct))}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", width: VALUE_W, fontSize: 27, color: OG.muted }}>{formatValue(a)}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {counts.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, height: 56, borderTop: "1px solid #E1ECF6", paddingTop: 8 }}>
              <div style={{ display: "flex", fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: 3, color: OG.muted, marginRight: 8 }}>SEASON COUNTS</div>
              {counts.slice(0, 4).map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "baseline", gap: 8, background: OG.rink, borderRadius: 10, padding: "4px 16px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 32, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>{c.value}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 19, fontWeight: 700, letterSpacing: 2, color: "#C9D6E6" }}>{c.label}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "center", fontSize: 20, color: OG.muted, paddingTop: 8 }}>{opts.note}</div>
        </div>
      </div>
    ),
  });
}
