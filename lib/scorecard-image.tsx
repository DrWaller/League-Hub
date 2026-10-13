import { ImageResponse } from "next/og";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { ordinal } from "./format";
import { TIERS, TIER_ORDER, tierOf, type TierName } from "./tiers";
import { formatValue } from "./radar-image";
import type { Standing } from "./radar";
import type { CardOpts } from "./player-card-opts";

// Scorecard (portrait, dark): the same numbers as the bars card, laid out like a heat map. Every category is a
// tile coloured by the tier its percentile earns (the same five colours as the tier badges), so the card can be
// read from across the room: a big tier tile, the fantasy points, then the grid.

const W = 1080;
const H = 1350;
const PAD = 40;
const GAP = 14;
const INNER = W - PAD * 2;
const MUTED = "#8FA6BD";
const FAINT = "#5F7A94";

const tileFg = (t: TierName) => TIERS[t].fg;

export async function renderScorecard(opts: CardOpts) {
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const { points, tier, qualified } = opts;
  const t = tier ? TIERS[tier] : null;

  // category tiles: league categories with a percentile
  const axes = opts.axes;
  const cols = axes.length <= 6 ? 2 : 3;
  const rows = Math.ceil(axes.length / cols);
  const tileW = Math.floor((INNER - GAP * (cols - 1)) / cols);

  const HEADER_H = 200;
  const HERO_H = 256;
  const LEGEND_H = 40;
  const COUNTS_H = opts.counts.length > 0 ? 64 : 0;
  const FOOTER_H = 74;
  const gridTop = PAD + HEADER_H + GAP + HERO_H + GAP;
  const avail = H - gridTop - 62 - FOOTER_H - LEGEND_H - GAP * 2 - (COUNTS_H ? COUNTS_H + GAP : 0) - 8;
  const tileH = Math.max(96, Math.min(rows <= 3 ? 230 : 190, Math.floor((avail - GAP * (rows - 1)) / Math.max(1, rows))));

  const nameSize = Math.max(46, Math.min(82, Math.floor(620 / (opts.name.length * 0.5))));
  const tierSize = tier ? Math.min(92, Math.floor(300 / (tier.length * 0.56))) : 60;

  const standing = (label: string, s: Standing) => (
    <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <div style={{ display: "flex", width: 60, fontSize: 18, fontWeight: 600, letterSpacing: 1.5, color: MUTED }}>{label}</div>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, color: "#FFFFFF" }}>{`#${s.rank}`}</div>
      <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: FAINT }}>{ordinal(Math.min(99, Math.round(s.pct)))}</div>
    </div>
  );
  const posLabel = opts.groupName === "forwards" ? "FWD" : opts.groupName === "defensemen" ? "D" : "G";
  const pointTile = (label: string, value: string, line: typeof points.total) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", borderRadius: 22, background: "#13283F", border: "1px solid #24405E", padding: "18px 22px 16px 22px" }}>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 5, color: MUTED }}>{label}</div>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 86, lineHeight: 1, color: "#FFFFFF" }}>{value}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {standing("ALL", line.all)}
        {standing(posLabel, line.position)}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: PAD, fontFamily: body, backgroundImage: "radial-gradient(circle at 85% 0%, #17426E 0%, #0B1D30 45%, #07121F 100%)" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: HEADER_H }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <PlayerAvatar name={opts.name} src={opts.photoUrl ?? headshotUrl(opts.playerId)} hasHeadshot={opts.hasHeadshot} size={176} fontFamily={display} fontSize={62} border={`7px solid ${t ? (tier === "Superstar" ? "#F4C95D" : t.fg === "#FFFFFF" ? "#FFFFFF" : "#F4C95D") : "#FFFFFF"}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{opts.name}</div>
              <div style={{ display: "flex", fontSize: 30, color: "#C9D6E6", whiteSpace: "nowrap" }}>{opts.teamName ? `${opts.position} · ${opts.teamName}` : opts.position}</div>
              <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{opts.isPast ? `${opts.seasonLabel} season · final` : `${opts.seasonLabel} · season to date`}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 22px 8px 22px", borderRadius: 16, border: "3px solid #E0AE4A" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>GP</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 72, lineHeight: 1, color: "#E0AE4A" }}>{String(opts.gp)}</div>
          </div>
        </div>

        {/* hero row: tier tile, total, per game */}
        <div style={{ display: "flex", gap: GAP, height: HERO_H, marginTop: GAP }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 340, borderRadius: 22, padding: "18px 24px 18px 24px", backgroundImage: t ? t.bg : "linear-gradient(135deg, #3A4B5E 0%, #2A3A4C 100%)", color: t ? t.fg : "#FFFFFF" }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 5, opacity: 0.85 }}>TIER</div>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: tierSize, lineHeight: 1, textTransform: "uppercase", letterSpacing: 1 }}>{tier ?? "NOT YET"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 21, fontWeight: 600 }}>
              <div style={{ display: "flex" }}>{tier ? `${ordinal(Math.min(99, Math.round(points.avg.position.pct)))} percentile` : `${opts.gp} of ${opts.minGP} GP played`}</div>
              <div style={{ display: "flex", opacity: 0.85 }}>{tier ? `per game, among ${opts.groupName}` : "needs more games"}</div>
            </div>
          </div>
          {pointTile("FANTASY PTS", points.total.value.toFixed(2), points.total)}
          {pointTile("PER GAME", points.avg.value.toFixed(2), points.avg)}
        </div>

        {/* category tiles */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 56, marginTop: 6 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 5, color: MUTED }}>YOUR LEAGUE&apos;S CATEGORIES</div>
          <div style={{ display: "flex", flexGrow: 1, height: 2, background: "#1E3752" }} />
          <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: FAINT }}>percentile, per game</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: GAP }}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} style={{ display: "flex", gap: GAP }}>
              {axes.slice(r * cols, r * cols + cols).map((a) => {
                const tt = tierOf(a.pct);
                const bg = qualified ? TIERS[tt].bg : "linear-gradient(135deg, #1B3149 0%, #1B3149 100%)";
                const fg = qualified ? tileFg(tt) : MUTED;
                return (
                  <div key={a.statId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, height: tileH, borderRadius: 18, padding: "0 28px", backgroundImage: bg, color: fg }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 34, letterSpacing: 1, lineHeight: 1 }}>{a.label}</div>
                      <div style={{ display: "flex", fontSize: 23, fontWeight: 600, opacity: 0.88 }}>{formatValue(a)}</div>
                    </div>
                    <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: Math.min(100, tileH - 40), lineHeight: 1 }}>{qualified ? String(Math.round(a.pct)) : "–"}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {opts.counts.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: COUNTS_H, marginTop: GAP }}>
            <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 4, color: MUTED, marginRight: 6 }}>SEASON COUNTS</div>
            {opts.counts.slice(0, 5).map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "baseline", gap: 8, borderRadius: 12, background: "#13283F", border: "1px solid #24405E", padding: "6px 16px" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 32, color: "#FFFFFF", lineHeight: 1.1 }}>{c.value}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: MUTED }}>{c.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* colour key */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: LEGEND_H, marginTop: GAP * 2, paddingBottom: 4 }}>
          {[...TIER_ORDER].map((n) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", width: 22, height: 22, borderRadius: 6, backgroundImage: TIERS[n].bg }} />
              <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: MUTED }}>{`${n} · ${n === "Replacement" ? "<50" : TIERS[n].min + "+"}`}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: FOOTER_H, fontFamily: display, letterSpacing: 2 }}>
          <div style={{ display: "flex", fontSize: 22, color: FAINT }}>{opts.footer}</div>
          <div style={{ display: "flex", fontSize: 18, color: "#46607A", marginTop: 4 }}>{`PERCENTILE VS ${opts.eligible} NHL ${opts.groupName.toUpperCase()} \u00b7 PER GAME \u00b7 ${opts.minGP}+ GP`}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}
