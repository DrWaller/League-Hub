import { OG } from "./og-theme";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";

// The header band of the player cards: the player himself (photo, name, position and team)
// instead of a card-type title, with games played on the right.

const GOLD = "#E0AE4A";

export function PlayerHeader(p: {
  display: string;
  playerId: number;
  name: string;
  position: string;
  teamName?: string;
  hasHeadshot: boolean;
  photoUrl?: string; // defaults to the ESPN headshot for playerId
  subtitle: string; // e.g. "Season to date - your league's categories"
  gp: number;
  notQualified?: string; // e.g. "NOT QUALIFIED - 2 of 3 GP"
}) {
  // Long names step down so they stay on one line.
  const nameSize = Math.max(44, Math.min(70, Math.floor(640 / (p.name.length * 0.52))));
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, minWidth: 0 }}>
        <PlayerAvatar name={p.name} src={p.photoUrl ?? headshotUrl(p.playerId)} hasHeadshot={p.hasHeadshot} size={150} fontFamily={p.display} fontSize={54} border={`6px solid ${GOLD}`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", fontFamily: p.display, fontWeight: 700, fontSize: nameSize, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap", maxWidth: 640, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#C9D6E6", maxWidth: 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.teamName ? `${p.position} \u00b7 ${p.teamName}` : p.position}</div>
          {p.notQualified ? (
            <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", background: "#FFF1CF", border: `2px solid ${GOLD}`, borderRadius: 8, padding: "2px 12px", fontSize: 20, fontWeight: 700, letterSpacing: 1, color: OG.goldText }}>{p.notQualified}</div>
          ) : (
            <div style={{ display: "flex", fontSize: 22, color: "#9FB6CD", maxWidth: 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, padding: "6px 22px 8px 22px", border: `3px solid ${GOLD}`, borderRadius: 16 }}>
        <div style={{ display: "flex", fontFamily: p.display, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#C9D6E6" }}>GP</div>
        <div style={{ display: "flex", fontFamily: p.display, fontWeight: 700, fontSize: 76, lineHeight: 1, color: GOLD }}>{String(p.gp)}</div>
      </div>
    </div>
  );
}
