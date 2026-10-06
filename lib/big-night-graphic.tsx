import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { OG } from "./og-theme";
import { TeamLine } from "./og-team-logo";
import { prettyDate } from "./nightly-blurbs";
import type { StoredNight } from "./nightly-store";

// Portrait (1080 x 1350) "Big Nights" card for one night: the Game of the Night
// featured Player-Spotlight style on top, the other big games as rows below.
// Built on frame() so the header, rink background and footer match the rest.
// Same Satori rules as the other graphics: every element with more than one
// child needs display:flex, and text is a single precomputed string.

const H = 1350;
const CHROME = 206 + 64 + 40; // header + footer + body padding (same as portrait-graphics)

const POSITION_NAMES: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goaltender",
};

// The saved stat line ("2 G \u00b7 1 A \u00b7 3 SOG", "13 SV \u00b7 1.000 \u00b7 0 GA") back into tiles.
// A part with no label is a goalie's save percentage.
function tilesFromLine(line: string | null): { value: string; label: string }[] {
  if (!line) return [];
  const names: Record<string, string> = { G: "GOALS", A: "ASSISTS", SOG: "SHOTS", SV: "SAVES", GA: "GA" };
  return line.split(" \u00b7 ").map((part) => {
    const m = part.trim().match(/^(\S+)\s+(\S+)$/);
    return m ? { value: m[1], label: names[m[2]] ?? m[2] } : { value: part.trim(), label: "SV%" };
  });
}

function dateParts(ymd: string): { month: string; day: string } {
  const d = new Date(`${ymd}T12:00:00Z`);
  return {
    month: d.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
    day: String(d.getUTCDate()),
  };
}

export async function renderBigNights(opts: {
  night: StoredNight;
  footer: string;
  logos: Record<number, string>;
  headshots: Set<number>;
}) {
  const { night, logos, headshots } = opts;
  const star = night.blurbs.find((b) => b.gameOfNight);
  const rest = night.blurbs.filter((b) => b !== star).sort((a, b) => b.points - a.points);
  const { month, day } = dateParts(night.date);
  // A quiet night (one or two big games) gets a bigger featured card instead of a half-empty page.
  const roomy = rest.length <= 2;
  const STAR_H = rest.length === 0 ? 720 : roomy ? 560 : 440;
  const rowsAvail = H - CHROME - (star ? STAR_H + 20 : 0) - 52;
  const rowH = Math.min(roomy ? 150 : 96, Math.floor(rowsAvail / Math.max(1, rest.length)));

  return frame({
    footer: opts.footer,
    title: "Big Nights",
    subtitle: prettyDate(night.date),
    headerContent: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: 968 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
            Big Nights
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#C9D6E6", marginTop: 14 }}>{prettyDate(night.date)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "8px 28px 10px 28px", border: `3px solid ${OG.gold}`, borderRadius: 16 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>{month}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 92, lineHeight: 1, color: OG.gold }}>{day}</div>
        </div>
      </div>
    ),
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 20 }}>
        {star ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: STAR_H,
              background: "#FFFFFF",
              borderTop: `6px solid ${OG.gold}`,
              borderLeft: `1px solid ${OG.iceLine}`,
              borderRight: `1px solid ${OG.iceLine}`,
              borderBottom: `1px solid ${OG.iceLine}`,
              borderRadius: 12,
              padding: "26px 36px",
              justifyContent: roomy ? "center" : "flex-start",
            }}
          >
            <div style={{ display: "flex", fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: 4, color: OG.goldText }}>GAME OF THE NIGHT</div>
            <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 16 }}>
              <PlayerAvatar name={star.playerName} src={headshotUrl(star.playerId)} hasHeadshot={headshots.has(star.playerId)} size={roomy ? 250 : 190} fontFamily={display} fontSize={roomy ? 86 : 66} border={`6px solid ${OG.gold}`} />
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 4 }}>
                <div style={{ display: "flex", fontFamily: display, fontSize: 18, fontWeight: 700, color: OG.goldText, letterSpacing: 2 }}>
                  {(POSITION_NAMES[star.position] ?? star.position).toUpperCase()}
                </div>
                <div style={{ display: "flex", fontFamily: display, fontSize: roomy ? 62 : 52, fontWeight: 700, color: OG.board, lineHeight: 1.05 }}>{star.playerName}</div>
                <TeamLine name={star.teamName} logo={logos[star.teamId]} size={28} fontSize={22} align="flex-start" />
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: roomy ? 84 : 68, fontWeight: 700, color: OG.centerRed, lineHeight: 1 }}>{star.points.toFixed(2)}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 24, fontWeight: 700, color: OG.muted, letterSpacing: 2, paddingBottom: 6 }}>{star.active ? "PTS" : "PTS - NOT IN LINEUP"}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
              {tilesFromLine(star.statLine).map((t) => (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: roomy ? 190 : 150, background: OG.rink, borderRadius: 10, padding: "12px 20px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: roomy ? 56 : 44, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>{t.value}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#C9D6E6" }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rest.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", height: 52, alignItems: "center", borderBottom: `2px solid ${OG.rink}`, fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: 3, color: OG.muted }}>
              {star ? "ALSO BIG" : "BIG GAMES"}
            </div>
            {rest.map((b, i) => (
              <div key={b.playerId} style={{ display: "flex", alignItems: "center", height: rowH, gap: 18, padding: "0 20px", background: i % 2 === 0 ? "#FFFFFF" : OG.icePanel }}>
                <PlayerAvatar name={b.playerName} src={headshotUrl(b.playerId)} hasHeadshot={headshots.has(b.playerId)} size={Math.min(roomy ? 96 : 68, rowH - 14)} fontFamily={display} fontSize={24} />
                <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", fontSize: 29, fontWeight: 700, color: OG.board, maxWidth: 520, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{b.playerName}</div>
                    {b.active ? null : (
                      <div style={{ display: "flex", fontFamily: display, fontSize: 15, fontWeight: 700, letterSpacing: 1, color: OG.muted, border: `1px solid ${OG.iceLine}`, borderRadius: 4, padding: "2px 8px" }}>NOT IN LINEUP</div>
                    )}
                  </div>
                  <div style={{ display: "flex", fontSize: 20, color: OG.muted, maxWidth: 640, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {`${b.position} - ${b.teamName}${b.statLine ? ` - ${b.statLine}` : ""}`}
                  </div>
                </div>
                <div style={{ display: "flex", fontFamily: display, fontSize: 40, fontWeight: 700, color: OG.centerRed }}>{b.points.toFixed(2)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
  });
}
