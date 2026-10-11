import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { OG } from "./og-theme";
import type { NightlyBlurb } from "./nightly-blurbs";

// The "editorial" alternate for the Big Night card: a big headshot on the left over a faded team logo and a
// team-color wash, with the name, team and points stacked on the right and the stat tiles along the bottom.
// renderBigNightCard (lib/big-night-card.tsx) does the data work and hands the finished pieces to this file.
// Pick it with ?layout=editorial on the graphic route, or set CARD_LAYOUT at the top of big-night-card.tsx.
// Same Satori rules as the other graphics: every element with more than one child needs display:flex.

export type EditorialProps = {
  blurb: NightlyBlurb;
  footer: string;
  logo?: string; // team logo as embedded image data (none = no logo shown)
  hasHeadshot: boolean;
  tiles: { value: string; label: string }[];
  teamColor: string;
  monster: boolean;
  special: string | null; // "HAT TRICK" / "SHUTOUT"
  specialDetail?: string; // "3 GOALS" / "26 SAVES"
  positionName: string;
  month: string;
  day: string;
};

// Largest font size (up to cap) at which a word of this length still fits the text column.
const fit = (text: string, cap: number, room = 395) => Math.max(40, Math.min(cap, Math.floor(room / (Math.max(1, text.length) * 0.62))));

export async function renderEditorialCard(p: EditorialProps) {
  const { blurb: b, tiles, logo, monster } = p;
  const accent = monster ? OG.centerRed : OG.gold;
  const [first, ...rest] = b.playerName.trim().split(/\s+/);
  const last = rest.join(" ") || first;
  const firstName = rest.length ? first : "";

  const n = tiles.length;
  const cols = n <= 4 ? Math.max(1, n) : n <= 6 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(n / cols));
  const GAP = 16;
  const ROW_W = 924;
  const tileW = Math.floor((ROW_W - GAP * (cols - 1)) / cols);
  const tileValue = rows === 1 ? 70 : rows === 2 ? 60 : 46;
  const tileLabel = rows === 3 ? 20 : 24;
  const tilePad = rows === 1 ? "14px 8px 16px" : rows === 2 ? "8px 8px 10px" : "6px 6px 8px";
  const nameCap = rows === 1 ? 84 : rows === 2 ? 72 : 62;
  const ptsSize = rows === 1 ? 165 : rows === 2 ? 150 : 120;
  // The headshot (ESPN's are landscape, about 1.38:1) is sized so its shoulders end before the text column starts.
  const PHOTO_W = 690;
  const PHOTO_H = Math.round(PHOTO_W / 1.38);
  const PHOTO_LEFT = -135;
  const TEXT_LEFT = 568;
  const TEXT_W = 400;

  return frame({
    footer: p.footer,
    title: monster ? "Monster Night" : "Big Night",
    subtitle: "",
    headerContent: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: 968 }}>
        <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
          {monster ? "Monster Night" : "Big Night"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "8px 28px 10px 28px", border: `3px solid ${OG.gold}`, borderRadius: 16 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>{p.month}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 92, lineHeight: 1, color: OG.gold }}>{p.day}</div>
        </div>
      </div>
    ),
    body: ({ display, body }) => (
      <div style={{ display: "flex", flexGrow: 1, paddingBottom: 8 }}>
        <div style={{ display: "flex", position: "relative", flexGrow: 1, overflow: "hidden", background: "#FFFFFF", borderTop: `8px solid ${accent}`, borderLeft: `1px solid ${OG.iceLine}`, borderRight: `1px solid ${OG.iceLine}`, borderBottom: `1px solid ${OG.iceLine}`, borderRadius: 12, boxShadow: "0 6px 16px rgba(18,58,97,0.10)" }}>
          {/* team-color wash and a thin accent edge, both angled (no rotated boxes: Satori doesn't clip those) */}
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 984, height: 1040, backgroundImage: `linear-gradient(112deg, ${p.teamColor}70 0%, ${p.teamColor}70 6%, ${p.teamColor}30 6%, ${p.teamColor}22 30%, ${p.teamColor}00 52%)` }} />
          <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 984, height: 1040, backgroundImage: `linear-gradient(112deg, ${accent}00 0%, ${accent}00 6%, ${accent}66 6%, ${accent}66 7.5%, ${accent}00 7.5%)` }} />

          {/* hat trick / shutout: a banner across the top of the card */}
          {p.special ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, position: "absolute", left: 0, top: 0, width: 984, height: 62, background: accent }}>
              <div style={{ display: "flex", width: 70, height: 4, background: monster ? "#FFFFFF" : OG.board, opacity: 0.55 }} />
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: 8, color: monster ? "#FFFFFF" : OG.board }}>{p.special}</div>
              {p.specialDetail ? <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: monster ? "#FFFFFF" : OG.board, opacity: 0.8 }}>{p.specialDetail}</div> : null}
              <div style={{ display: "flex", width: 70, height: 4, background: monster ? "#FFFFFF" : OG.board, opacity: 0.55 }} />
            </div>
          ) : null}

          {logo ? (
            <div style={{ display: "flex", position: "absolute", left: 40, top: 110, width: 470, height: 470, opacity: 0.14, alignItems: "center", justifyContent: "center" }}>
              <img src={logo} width={470} height={470} style={{ objectFit: "contain" }} />
            </div>
          ) : null}

          {/* everything below the banner is one column: the photo + text area fills what's left above the tiles,
              so the headshot always stands right on top of the stat tiles, whatever the tile count */}
          <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
            <div style={{ display: "flex", position: "relative", flexGrow: 1, overflow: "hidden" }}>
              {/* the player: bottom-anchored, kept left of the text column so the shoulders never reach the points */}
              {p.hasHeadshot ? (
                <img src={headshotUrl(b.playerId)} width={PHOTO_W} height={PHOTO_H} style={{ position: "absolute", left: PHOTO_LEFT, bottom: -4, objectFit: "contain", objectPosition: "center bottom" }} />
              ) : (
                <div style={{ display: "flex", position: "absolute", left: 70, bottom: 60 }}>
                  <PlayerAvatar name={b.playerName} src={headshotUrl(b.playerId)} hasHeadshot={false} size={400} fontFamily={display} fontSize={150} border={`8px solid ${OG.gold}`} />
                </div>
              )}

              {/* text block, vertically centred in the space above the tiles */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", position: "absolute", left: TEXT_LEFT, top: p.special ? 62 : 0, bottom: 0, width: TEXT_W }}>
                <div style={{ display: "flex", alignSelf: "flex-start", padding: "6px 22px 6px 26px", borderRadius: 8, background: accent, fontFamily: display, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: monster ? "#FFFFFF" : OG.board }}>
                  {p.positionName.toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontFamily: display, fontWeight: 700, color: OG.board, lineHeight: 1.02, textTransform: "uppercase" }}>
                  {firstName ? <div style={{ display: "flex", fontSize: fit(firstName, nameCap) }}>{firstName}</div> : null}
                  <div style={{ display: "flex", fontSize: fit(last, nameCap + 16) }}>{last}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, marginTop: rows === 1 ? 20 : 14 }}>
                  {logo ? <img src={logo} width={50} height={50} style={{ objectFit: "contain" }} /> : null}
                  <div style={{ display: "flex", fontFamily: body, fontSize: b.teamName.length > 24 ? 26 : 30, fontWeight: 600, color: OG.muted }}>{b.teamName}</div>
                </div>
                <div style={{ display: "flex", width: 90, height: 5, borderRadius: 3, background: accent, marginTop: rows === 1 ? 22 : 14 }} />
                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", marginTop: 8 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: ptsSize, lineHeight: 1, color: OG.centerRed }}>{b.points.toFixed(2)}</div>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: 2, color: OG.muted, paddingLeft: 12, paddingBottom: rows === 1 ? 34 : 24 }}>PTS</div>
                </div>
                {b.active ? null : <div style={{ display: "flex", marginTop: 6, fontSize: 22, color: OG.muted }}>Not in the active lineup, so these points did not count</div>}
              </div>
            </div>

            {/* stat tiles */}
            {n > 0 ? (
              <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: GAP, width: ROW_W, marginLeft: 30, marginBottom: 34 }}>
                {tiles.map((t) => (
                  <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: tileW, background: OG.rink, borderTop: `5px solid ${accent}`, borderRadius: 12, padding: tilePad }}>
                    <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: tileValue, color: "#FFFFFF", lineHeight: 1.1 }}>{t.value}</div>
                    <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: tileLabel, letterSpacing: 1.5, color: "#C9D6E6" }}>{t.label}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
  });
}
