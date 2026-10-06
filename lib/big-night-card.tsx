import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { OG } from "./og-theme";
import { TeamLine } from "./og-team-logo";
import { prettyDate, type NightlyBlurb } from "./nightly-blurbs";

// One portrait (1080 x 1350) card for ONE player's big night, laid out like the
// Player Spotlight: headshot with the gold ring, position, name, team, points,
// stat tiles. Built on frame() so the header, rink background and footer match.
// Same Satori rules as the other graphics: every element with more than one
// child needs display:flex, and text is a single precomputed string.

const POSITION_NAMES: Record<string, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goaltender",
};

// Why the night was big, when there's a specific reason worth a tag.
// (A night that qualified on fantasy points alone gets no tag.)
const MILESTONE: Partial<Record<NightlyBlurb["kind"], string>> = {
  HAT_TRICK: "HAT TRICK",
  MULTI_GOAL: "MULTI-GOAL NIGHT",
  BIG_POINTS: "BIG POINTS NIGHT",
  SHUTOUT: "SHUTOUT",
  SAVE_FEST: "40+ SAVES",
  MELTDOWN: "ROUGH NIGHT",
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

export async function renderBigNightCard(opts: {
  date: string; // YYYY-MM-DD
  blurb: NightlyBlurb;
  footer: string;
  logos: Record<number, string>;
  hasHeadshot: boolean;
}) {
  const { blurb: b, logos } = opts;
  const { month, day } = dateParts(opts.date);
  const tiles = tilesFromLine(b.statLine);
  const tag = MILESTONE[b.kind];
  const nameSize = b.playerName.length > 20 ? 56 : 72;

  return frame({
    footer: opts.footer,
    title: "Big Night",
    subtitle: prettyDate(opts.date),
    headerContent: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: 968 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
            Big Night
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#C9D6E6", marginTop: 14 }}>{prettyDate(opts.date)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "8px 28px 10px 28px", border: `3px solid ${OG.gold}`, borderRadius: 16 }}>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>{month}</div>
          <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: 92, lineHeight: 1, color: OG.gold }}>{day}</div>
        </div>
      </div>
    ),
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingBottom: 8 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            background: "#FFFFFF",
            borderTop: `8px solid ${OG.gold}`,
            borderLeft: `1px solid ${OG.iceLine}`,
            borderRight: `1px solid ${OG.iceLine}`,
            borderBottom: `1px solid ${OG.iceLine}`,
            borderRadius: 12,
            boxShadow: "0 6px 16px rgba(18,58,97,0.10)",
            padding: "28px 40px",
          }}
        >
          <PlayerAvatar name={b.playerName} src={headshotUrl(b.playerId)} hasHeadshot={opts.hasHeadshot} size={300} fontFamily={display} fontSize={104} border={`8px solid ${OG.gold}`} />
          <div style={{ display: "flex", fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 4, color: OG.goldText, marginTop: 26 }}>
            {(POSITION_NAMES[b.position] ?? b.position).toUpperCase()}
          </div>
          <div style={{ display: "flex", fontFamily: display, fontSize: nameSize, fontWeight: 700, color: OG.board, lineHeight: 1.1, marginTop: 6, textAlign: "center" }}>{b.playerName}</div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <TeamLine name={b.teamName} logo={logos[b.teamId]} size={36} fontSize={30} align="center" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 18 }}>
            <div style={{ display: "flex", fontFamily: display, fontSize: 128, fontWeight: 700, color: OG.centerRed, lineHeight: 1 }}>{b.points.toFixed(2)}</div>
            <div style={{ display: "flex", fontFamily: display, fontSize: 34, fontWeight: 700, color: OG.muted, letterSpacing: 2, paddingBottom: 12 }}>PTS</div>
          </div>
          {tag ? (
            <div style={{ display: "flex", marginTop: 14, fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: 3, color: OG.goldText, border: `3px solid ${OG.gold}`, borderRadius: 999, padding: "6px 26px" }}>{tag}</div>
          ) : null}
          {b.active ? null : (
            <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: OG.muted }}>Not in the active lineup, so these points did not count</div>
          )}
          {tiles.length > 0 ? (
            <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
              {tiles.map((t) => (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200, background: OG.rink, borderRadius: 12, padding: "16px 24px" }}>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 60, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>{t.value}</div>
                  <div style={{ display: "flex", fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: 3, color: "#C9D6E6" }}>{t.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
  });
}
