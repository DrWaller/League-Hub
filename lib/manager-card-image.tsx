import { ImageResponse } from "next/og";
import { getFontFamilies, loadGraphicFonts } from "./og-fonts";
import { NO_CACHE } from "./og-theme";
import { shade } from "./nhl-colors";
import { ordinal } from "./format";
import type { ManagerCardData } from "./manager-card";

// Manager trading card (5:7), the same format as the player hockey card: the team's colours and logo as the
// picture, the manager's name on the nameplate, then a "back of the card" with the career numbers, the
// nemesis and victim, and the style tags the numbers earned.

const W = 1050;
const H = 1470;
const CREAM = "#F4EBD3";
const INK = "#10243B";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
const lighten = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * a);
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
};
const isHex = (v?: string) => Boolean(v && /^#[0-9a-f]{6}$/i.test(v));

export async function renderManagerCard(d: ManagerCardData) {
  const fonts = await loadGraphicFonts();
  const { display, body } = getFontFamilies(fonts);
  const c1 = isHex(d.primary) ? d.primary! : "#123A61";
  const dark = shade(c1, 0.55);
  // The outline is the same navy as the stats panel, so the card has one neutral frame whatever the team colours; the stripe and highlight text are a light tint of the team colour.
  const trim = lighten(c1, 0.35);
  const frame = `linear-gradient(160deg, ${shade(c1, 0.78)} 0%, ${shade(c1, 0.92)} 100%)`;
  const accent = lighten(c1, 0.6);

  const parts = d.name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;
  const showFirst = parts.length > 1;
  const lastSize = Math.max(64, Math.min(120, Math.floor(620 / (last.length * 0.5))));
  const initials = (d.team ?? d.name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 3).join("").toUpperCase();
  const years = d.firstSeason && d.lastSeason ? (d.firstSeason === d.lastSeason ? `${d.lastSeason}` : `${d.firstSeason}–${String(d.lastSeason).slice(2)}`) : "";
  const record = `${d.wins}-${d.losses}${d.ties ? `-${d.ties}` : ""}`;
  const seal = d.tags[0] ?? "";

  const ART_H = 610;
  const boxes: [string, string, string?][] = [
    ["RUNNER-UPS", String(d.runnerUps)],
    ["FIRST PLACE", String(d.firstPlace)],
    ["PTS / GAME", d.avgScore ? d.avgScore.toFixed(1) : "–", d.scoreRank ? `${ordinal(d.scoreRank)} of ${d.managerCount}` : undefined],
    ["BEST SEASON", d.best ? String(d.best.season) : "–", d.best?.record],
  ];

  const duel = (label: string, who: { name: string; record: string } | null, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "10px 20px 12px 20px", borderRadius: 14, border: "1px solid #2A4767", background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color }}>{label}</div>
      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: "#FFFFFF", whiteSpace: "nowrap" }}>{who ? who.name.toUpperCase().slice(0, 18) : "–"}</div>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#9FB6CD" }}>{who ? `${who.record} head to head` : "not enough games yet"}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 30, backgroundImage: frame, fontFamily: body }}>
        <div style={{ display: "flex", position: "relative", overflow: "hidden", width: W - 60, height: ART_H, borderRadius: 22, border: `9px solid ${trim}`, backgroundImage: `linear-gradient(165deg, ${c1} 0%, ${dark} 100%)` }}>
          <div style={{ display: "flex", position: "absolute", left: -200, top: 190, width: 1500, height: 170, background: "rgba(255,255,255,0.07)", transform: "rotate(-24deg)" }} />
          <div style={{ display: "flex", position: "absolute", left: 90, top: 310, width: 900, height: 16, background: accent, opacity: 0.55, transform: "rotate(-24deg)" }} />
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og JSX
            <img src={d.logo} width={380} height={380} style={{ position: "absolute", left: 314, top: 24, width: 380, height: 380, objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 120, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 300, color: "rgba(255,255,255,0.88)" }}>{initials}</div>
          )}

          <div style={{ display: "flex", position: "absolute", left: 28, top: 26, alignItems: "center", justifyContent: "center", width: 112, height: 112, borderRadius: 56, background: CREAM, border: `6px solid ${trim}`, fontFamily: display, fontWeight: 700, fontSize: 52, color: INK }}>GM</div>
          {seal ? (
            <div style={{ display: "flex", position: "absolute", right: 28, top: 30, alignItems: "center", padding: "10px 28px", borderRadius: 40, background: CREAM, border: `5px solid ${trim}`, color: INK, fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: 4 }}>{seal.toUpperCase()}</div>
          ) : null}

          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: 200, flexDirection: "column", justifyContent: "center", padding: "10px 36px 0 36px", background: shade(c1, 0.7), borderTop: `7px solid ${trim}` }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {showFirst ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 38, letterSpacing: 8, lineHeight: 1.1, color: accent, textTransform: "uppercase" }}>{first}</div> : null}
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: lastSize, lineHeight: 1, textTransform: "uppercase", color: "#FFFFFF", whiteSpace: "nowrap" }}>{last}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingBottom: 6 }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>SEASONS</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 64, lineHeight: 1, color: accent }}>{String(d.seasons)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 62, padding: "0 6px" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: "#FFFFFF", textTransform: "uppercase" }}>{(d.team ?? "").slice(0, 30)}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: accent }}>{years}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, borderRadius: 22, padding: "20px 28px 18px 28px", backgroundImage: `linear-gradient(170deg, ${INK} 0%, #0A1828 100%)`, border: `4px solid ${trim}` }}>
          <div style={{ display: "flex", gap: 14 }}>
            {([["RECORD", record], ["WIN %", d.winPct ? d.winPct.toFixed(3).replace(/^0/, "") : ".000"], ["TITLES", String(d.titles)]] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, borderRadius: 14, background: "rgba(255,255,255,0.07)", padding: "8px 0 6px 0" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: 4, color: accent }}>{label}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 70, lineHeight: 1.05, color: "#FFFFFF" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
            {boxes.map(([label, value, sub]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "8px 14px 10px 14px", borderRadius: 14, border: "1px solid #2A4767", background: "rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 19, letterSpacing: 3, color: "#9FB6CD" }}>{label}</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 52, lineHeight: 1.05, color: "#FFFFFF" }}>{value}</div>
                <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#6C88A5", height: 24 }}>{sub ?? ""}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
            {duel("NEMESIS", d.nemesis, "#E58B7E")}
            {duel("FAVOURITE VICTIM", d.victim, "#8FD6A8")}
          </div>

          {d.franchise ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "10px 20px 12px 20px", borderRadius: 14, border: `1px solid ${accent}`, background: "rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: accent }}>FRANCHISE PLAYER</div>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 42, lineHeight: 1.1, color: "#FFFFFF", whiteSpace: "nowrap" }}>{d.franchise.name.toUpperCase().slice(0, 24)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 44, lineHeight: 1.1, color: "#FFFFFF" }}>{Math.round(d.franchise.points).toLocaleString("en-US")}</div>
                <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#9FB6CD" }}>{`pts over ${d.franchise.seasons} season${d.franchise.seasons === 1 ? "" : "s"}`}</div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 12, minHeight: 56, marginTop: 10 }}>
            {d.tags.slice(1).map((t) => (
              <div key={t} style={{ display: "flex", padding: "8px 22px", borderRadius: 30, border: `3px solid ${accent}`, fontFamily: display, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: accent, textTransform: "uppercase" }}>{t}</div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: display, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: "#6C88A5" }}>
            <div style={{ display: "flex" }}>{d.leagueName.toUpperCase().slice(0, 40)}</div>
            <div style={{ display: "flex" }}>CAREER CARD</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: NO_CACHE }
  );
}
