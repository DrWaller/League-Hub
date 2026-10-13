import { ImageResponse } from "next/og";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { headshotUrl } from "./headshots";
import { TIERS, tierOf } from "./tiers";
import { nhlTeam, shade } from "./nhl-colors";
import type { CardOpts } from "./player-card-opts";

// Hockey card (a true 5:7 trading card): the player on his NHL team's colours, a nameplate across the bottom of
// the picture, and a "back of the card" stat panel underneath with the league's categories. The tier shows as the
// seal in the corner, and the card number is his fantasy-points rank among everyone at his position.

const W = 1050;
const H = 1470;
const CREAM = "#F4EBD3";
const INK = "#10243B";

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <polygon points="12,1.5 15,8.6 22.5,9.3 16.8,14.3 18.6,21.8 12,17.8 5.4,21.8 7.2,14.3 1.5,9.3 9,8.6" fill={color} />
    </svg>
  );
}

export async function renderHockeyCard(opts: CardOpts) {
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const team = nhlTeam(opts.nhlAbbrev);
  const c1 = team?.c1 ?? "#123A61";
  const c2 = team?.c2 ?? "#E0AE4A";
  // A very dark or very light main colour (Bruins black, Red Wings red on white) needs a visible trim.
  const dark = shade(c1, 0.55);
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  const trim = lum(c2) < 0.3 || lum(c2) > 0.93 ? "#E0AE4A" : c2;
  // Text in the trim colour sits on a dark plate, so a dark trim (Avalanche blue) is lightened to stay readable.
  const lighten = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => Math.round(v + (255 - v) * a);
    return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
  };
  const accent = lum(trim) < 0.55 ? lighten(trim, 0.55) : trim;
  const tier = opts.tier;
  const t = tier ? TIERS[tier] : null;
  const { points } = opts;

  const parts = opts.name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;
  const showFirst = parts.length > 1;
  const lastSize = Math.max(64, Math.min(120, Math.floor(620 / (last.length * 0.5))));

  const ART_H = 860;
  const stats = opts.totals.slice(0, 8);
  const statCols = stats.length <= 6 ? 3 : 4;
  const rowsOf: (typeof stats)[] = [];
  for (let i = 0; i < stats.length; i += statCols) rowsOf.push(stats.slice(i, i + statCols));

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 30, backgroundImage: "linear-gradient(145deg, #F8F1DE 0%, #E9DDBD 100%)", fontFamily: body }}>
        {/* the picture */}
        <div style={{ display: "flex", position: "relative", overflow: "hidden", width: W - 60, height: ART_H, borderRadius: 22, border: `9px solid ${trim}`, backgroundImage: `linear-gradient(165deg, ${c1} 0%, ${dark} 100%)` }}>
          {/* diagonal bands and a watermark of the team */}
          <div style={{ display: "flex", position: "absolute", left: -200, top: 250, width: 1500, height: 190, background: "rgba(255,255,255,0.07)", transform: "rotate(-24deg)" }} />
          <div style={{ display: "flex", position: "absolute", left: -200, top: 500, width: 1500, height: 16, background: trim, opacity: 0.85, transform: "rotate(-24deg)" }} />
          <div style={{ display: "flex", position: "absolute", left: 20, top: 90, fontFamily: display, fontWeight: 700, fontSize: 470, lineHeight: 1, letterSpacing: -6, color: "rgba(255,255,255,0.08)" }}>{team?.abbrev ?? ""}</div>

          {opts.hasHeadshot ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og JSX
            <img src={opts.photoUrl ?? headshotUrl(opts.playerId)} width={850} height={620} style={{ position: "absolute", left: 60, bottom: 214, width: 850, height: 620, objectFit: "contain", objectPosition: "50% 100%" }} />
          ) : (
            <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 120, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 280, color: "rgba(255,255,255,0.9)" }}>
              {parts.map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}

          {/* position, top left */}
          <div style={{ display: "flex", position: "absolute", left: 28, top: 26, alignItems: "center", justifyContent: "center", width: 112, height: 112, borderRadius: 56, background: CREAM, border: `6px solid ${trim}`, fontFamily: display, fontWeight: 700, fontSize: 52, color: INK }}>{opts.position}</div>
          {/* tier seal, top right */}
          {t && tier ? (
            <div style={{ display: "flex", position: "absolute", right: 28, top: 30, alignItems: "center", gap: 12, padding: "10px 28px", borderRadius: 40, backgroundImage: t.bg, border: "4px solid #FFFFFF", color: t.fg, fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: 4 }}>
              {t.star ? <Star size={34} color={t.fg} /> : null}
              <div style={{ display: "flex" }}>{tier.toUpperCase()}</div>
            </div>
          ) : null}

          {/* nameplate */}
          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: 214, flexDirection: "column", justifyContent: "center", padding: "10px 36px 0 36px", background: shade(c1, 0.7), borderTop: `7px solid ${trim}` }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {showFirst ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 38, letterSpacing: 8, lineHeight: 1.1, color: accent, textTransform: "uppercase" }}>{first}</div> : null}
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: lastSize, lineHeight: 1, textTransform: "uppercase", color: "#FFFFFF", whiteSpace: "nowrap" }}>{last}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingBottom: 6 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>{`${opts.groupName === "forwards" ? "FWD" : opts.groupName === "defensemen" ? "D" : "G"} RANK`}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 64, lineHeight: 1, color: accent }}>{`#${points.avg.position.rank}`}</div>
              </div>
            </div>
          </div>
        </div>

        {/* team line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 62, padding: "0 6px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: INK, textTransform: "uppercase" }}>{team ? team.name : opts.teamName ?? ""}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "#7A6A45" }}>{`${opts.seasonLabel} · ${opts.gp} GP`}</div>
        </div>

        {/* back of the card: stats */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, borderRadius: 22, padding: "20px 28px 18px 28px", backgroundImage: `linear-gradient(170deg, ${INK} 0%, #0A1828 100%)`, border: `4px solid ${trim}` }}>
          <div style={{ display: "flex", gap: 14 }}>
            {([["FANTASY PTS", points.total.value.toFixed(2)], ["PER GAME", points.avg.value.toFixed(2)], [opts.groupName === "forwards" ? "FWD PERCENTILE" : opts.groupName === "defensemen" ? "D PERCENTILE" : "G PERCENTILE", `${Math.min(99, Math.round(points.avg.position.pct))}`]] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, borderRadius: 14, background: "rgba(255,255,255,0.07)", padding: "8px 0 6px 0" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 4, color: accent }}>{label}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 76, lineHeight: 1.05, color: "#FFFFFF" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: 12, marginTop: 14, marginBottom: 12 }}>
            {rowsOf.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                {row.map((s) => {
                  const c = s.pct !== undefined && opts.qualified ? TIERS[tierOf(s.pct)] : null;
                  const fill = s.pct !== undefined && s.pct > 0 ? Math.max(6, Math.round(s.pct)) : 0;
                  return (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "10px 18px 14px 18px", borderRadius: 14, border: "1px solid #2A4767", background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "#9FB6CD" }}>{s.label}</div>
                        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 56, lineHeight: 1.05, color: "#FFFFFF" }}>{s.value}</div>
                      </div>
                      <div style={{ display: "flex", width: "100%", height: 10, marginTop: 6, borderRadius: 5, background: "#1C3552" }}>
                        {c && fill > 0 ? <div style={{ display: "flex", width: `${fill}%`, height: 10, borderRadius: 5, backgroundImage: c.bg }} /> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: display, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: "#6C88A5" }}>
            <div style={{ display: "flex" }}>{opts.footer}</div>
            <div style={{ display: "flex" }}>{opts.teamName ? (/^owned by/i.test(opts.teamName) ? opts.teamName : `Rostered by ${opts.teamName}`).toUpperCase().slice(0, 44) : ""}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}
