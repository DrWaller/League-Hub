import { frame } from "./portrait-graphics";
import { TeamBadge } from "./og-team-logo";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";

// One portrait (1080 x 1350) graphic for any season-long award race: the navy scoreboard table (same look as the
// player races in race-scoreboard-image.tsx): top 5 rows, each with a player headshot or a team logo, a name, a
// detail line, a big number and the gap to the leader.
// Satori rules: every element with more than one child needs display:flex.

export interface RaceRow {
  rank: number;
  name: string;
  sub: string;
  value: string; // the big number
  gap: string; // "leader", "-3.20", ...
  playerId?: number; // draws a headshot
  teamId?: number; // draws that team's logo (when there is no player)
  teamName?: string;
  before?: string; // trend races: the player's best previous points per game ("1.99"), drawn in its own column
  jump?: string; // trend races: the gain over that ("+0.86"), drawn as a green badge
}

const GOLD = "#F2C46D";
const RANK_COLOR = [GOLD, "#C3CEDA", "#E3A57A", "#8FB4DA", "#8FB4DA"];
const RING = [GOLD, "#8A94A0", "#A0673D", "#5B86B3", "#5B86B3"];
const W_BIG = 200;
const W_GAP = 110;
const GAP = 14;
// Breakout layout: three labelled columns (BEST BEFORE, NOW, JUMP) take the place of the single big number.
const W_BEFORE = 170;
const W_NOW = 140;
const W_JUMP = 140;

// Oswald is condensed: about half an em per character. Shrink text to fit its column instead of clipping it.
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));
// "+0.45 pts/gm" -> "+0.45": the unit is in the column header instead.
const numberOf = (v: string) => v.split(" ")[0];

export async function renderPortraitRace(opts: {
  title: string;
  subtitle: string;
  footer?: string;
  rows: RaceRow[];
  valueLabel?: string; // column header over the big number ("PTS", "VOR", "RECORD"...)
  nowLabel?: string; // header over the big number when rows carry before/jump columns ("NOW")
  logos?: Record<number, string>;
  headshots?: Set<number>;
}) {
  const logos = opts.logos ?? {};
  const headshots = opts.headshots ?? new Set<number>();
  const rows = opts.rows.slice(0, 5);
  // Races with no gap to show (Sleeping Beauty, most trend awards) drop the "VS #1" column and give the name more room.
  const hasGap = rows.slice(1).some((r) => r.gap);
  const hasBefore = rows.some((r) => r.before);
  // Width of everything to the right of the name, and how many gaps that adds.
  const numW = hasBefore ? W_BEFORE + W_NOW + W_JUMP : W_BIG;
  const numGaps = hasBefore ? 5 : hasGap ? 4 : 3;
  const numCol = hasBefore ? W_NOW : W_BIG;
  return frame({
    dark: true,
    flush: true,
    footer: opts.footer,
    title: opts.title,
    subtitle: opts.subtitle,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 52, gap: GAP, padding: "0 22px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          <div style={{ display: "flex", width: 64, justifyContent: "center" }}>RK</div>
          <div style={{ display: "flex", flexGrow: 1 }}>{rows.some((r) => r.playerId != null) ? "PLAYER" : "MANAGER"}</div>
          {hasBefore ? (
            <>
              <div style={{ display: "flex", width: W_BEFORE, justifyContent: "center" }}>BEST BEFORE</div>
              <div style={{ display: "flex", width: W_NOW, justifyContent: "center", color: "#E3EAF3" }}>{opts.nowLabel ?? "NOW"}</div>
              <div style={{ display: "flex", width: W_JUMP, justifyContent: "center", color: "#4AE6A8" }}>JUMP</div>
            </>
          ) : (
            <div style={{ display: "flex", width: W_BIG, justifyContent: "flex-end" }}>{opts.valueLabel ?? "SCORE"}</div>
          )}
          {hasGap ? <div style={{ display: "flex", width: W_GAP, justifyContent: "flex-end" }}>VS #1</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => {
            const first = i === 0;
            const size = first ? 124 : 96;
            const rowH = first ? 240 : 178;
            // Room for the name column: row width less padding, rank, avatar, the number columns and the gaps between.
            const room = 1024 - 44 - 64 - size - numW - (hasGap ? W_GAP : 0) - GAP * numGaps;
            const nameSize = fit(room, r.name.length, 24, first ? 48 : 38);
            // The detail line may wrap onto a second line, so it can use about twice the room before it has to shrink.
            const subLines = r.sub.split(" / "); // e.g. a goalie tandem: one goalie per line
            const subSize = subLines.length > 1 ? fit(room, Math.max(...subLines.map((l) => l.length)), 16, first ? 26 : 23) : fit(room * 1.9, r.sub.length, 16, first ? 26 : 23);
            const gapText = first ? "LEADS" : r.gap;
            return (
              <div
                key={`${r.rank}-${r.name}`}
                style={{
                  display: "flex", alignItems: "center", gap: GAP, height: rowH, flexShrink: 0, padding: "0 22px", borderRadius: 16,
                  ...(first
                    ? { backgroundImage: "linear-gradient(90deg, #7A5712 0%, #3B3216 40%, #14304F 100%)", border: `2px solid ${GOLD}` }
                    : { background: "#173454", border: "1px solid #2A4E75" }),
                }}
              >
                <div style={{ display: "flex", width: 64, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: first ? 104 : 70, lineHeight: 1, color: RANK_COLOR[i] }}>{r.rank}</div>
                {r.playerId != null ? (
                  <PlayerAvatar name={r.name} src={headshotUrl(r.playerId)} hasHeadshot={headshots.has(r.playerId)} size={size} fontFamily={display} fontSize={first ? 46 : 34} border={`${first ? 5 : 4}px solid ${RING[i]}`} />
                ) : r.teamId != null ? (
                  <TeamBadge name={r.teamName ?? r.name} logo={logos[r.teamId]} size={size} fontFamily={display} />
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, color: "#FFFFFF", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ display: "flex", flexDirection: "column", fontSize: subSize, lineHeight: 1.2, color: first ? "#E6ECF3" : "#B8C7D6", maxHeight: Math.ceil(subSize * 1.2 * 2) }}>
                    {subLines.length > 1 ? subLines.map((l) => <div key={l} style={{ display: "flex" }}>{l}</div>) : r.sub}
                  </div>
                </div>
                {hasBefore ? (
                  <>
                    <div style={{ display: "flex", width: W_BEFORE, justifyContent: "center", fontFamily: display, fontWeight: 600, fontSize: fit(W_BEFORE, (r.before ?? "").length, 26, first ? 48 : 42), lineHeight: 1, color: "#9FB3C8" }}>{r.before ?? ""}</div>
                    <div style={{ display: "flex", width: W_NOW, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: fit(W_NOW, numberOf(r.value).length, 30, first ? 62 : 52), lineHeight: 1, color: first ? GOLD : "#FFFFFF" }}>{numberOf(r.value)}</div>
                    <div style={{ display: "flex", width: W_JUMP, justifyContent: "center" }}>
                      {r.jump ? (
                        <div style={{ display: "flex", padding: "4px 16px 6px 16px", borderRadius: 40, border: "2px solid #36D399", background: first ? "#124A36" : "#0F3B2E", fontFamily: display, fontWeight: 700, fontSize: first ? 38 : 34, lineHeight: 1, color: "#4AE6A8" }}>{r.jump}</div>
                      ) : null}
                    </div>
                  </>
                ) : (
                <div style={{ display: "flex", width: numCol, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: fit(W_BIG, numberOf(r.value).length, 30, first ? 62 : 50), lineHeight: 1, color: first ? GOLD : "#FFFFFF" }}>{numberOf(r.value)}</div>
                )}
                {hasGap ? (
                  <div style={{ display: "flex", width: W_GAP, justifyContent: "flex-end", fontFamily: display, fontWeight: 600, fontSize: first ? 28 : fit(W_GAP, gapText.length, 18, 28), letterSpacing: first ? 2 : 0, color: first ? GOLD : "#FF8FA0" }}>{gapText}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}
