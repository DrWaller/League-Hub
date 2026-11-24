import { frame } from "./portrait-graphics";
import { PlayerAvatar } from "./og-avatar";
import { headshotUrl } from "./headshots";
import { TIER_STYLE, TIERS } from "./tier-style";
import type { AssessedPick } from "./draft-assessment";
import type { KeeperTeam } from "./draft-keepers-image";
import { gradeColor, type DraftGrade } from "./draft-teams";
import { VALUE_TITLES, type ValueKind } from "./draft-value-split";

// Light "card" versions of the draft graphics, matching the keeper cards and the site: white cards with a tier-coloured
// stripe, a headshot, and tier-tinted tiles. Portrait 1080 x 1350. Satori: every element with more than one child needs
// display:flex, so each text is a single string.

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));
const NAVY = "#0C2740";
const MUTED = "#5B6672";
const AVAIL = 1350 - 192 - 64 - 40; // the card area under the header and above the footer

const tierColors = (tier: string | null | undefined) => {
  const st = tier ? TIER_STYLE[tier as keyof typeof TIER_STYLE] : null;
  const bg = st?.bg ?? "#EEF2F6";
  const fg = tier === "Superstar" ? "#FFFFFF" : st?.fg ?? MUTED;
  return { bg, fg, shadow: tier === "Superstar" ? "0 2px 3px rgba(60,40,0,0.35)" : "none" };
};

const TAG_BG: Record<string, string> = { STEAL: "#26864A", BUST: "#B8574A", "MISSED TIME": "#5B6672" };

// Every pick of a draft round (10) or half of a team's draft (7) as one row card: pick number, headshot, name, and
// Season / Total / Tier tiles tinted in the pick's tier colour.
// variant "keeper": no pick number (keepers aren't draft picks) and a VOR tile in place of Total. variant "value": the
// steals / busts / missed-time lists, with Current finish, VOR and a navy "vs slot" tile.
export async function renderPickCards(opts: { title: string; subtitle?: string; picks: AssessedPick[]; footer?: string; headshots?: Set<number>; labels?: Map<number, string>; hideTeam?: boolean; variant?: "pick" | "keeper" | "value"; valueUp?: boolean }) {
  const variant = opts.variant ?? "pick";
  const headshots = opts.headshots ?? new Set<number>();
  const n = Math.max(1, opts.picks.length);
  const gap = n > 8 ? 12 : 14;
  const rowH = Math.min(150, Math.floor((AVAIL - (n - 1) * gap) / n));
  const s = Math.min(1.35, rowH / 94); // text scale: a bit larger when there are only a few rows
  const tileH = rowH - 24;
  const avatar = Math.min(Math.round(66 * s), rowH - 22);
  const W_S = 122;
  const W_T = 122;
  const W_TIER = 172;
  const pkW = variant === "keeper" ? 0 : 58;
  return frame({
    title: opts.title,
    subtitle: opts.subtitle ?? "",
    footer: opts.footer,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {opts.picks.map((p) => {
          const c = tierColors(p.tier);
          const tag = opts.labels?.get(p.overall);
          const room = 984 - 12 - 14 - pkW - avatar - W_S - W_T - W_TIER - 12 * (variant === "keeper" ? 3 : 4) - 14 - 6;
          const tagW = tag ? Math.round(tag.length * 11 * s + 26) : 0;
          const nameSize = fit(room - tagW, p.name.length, Math.round(22 * s), Math.round(34 * s));
          const sub = [p.position, opts.hideTeam ? null : p.team, p.gp != null ? `${p.gp} GP` : null].filter(Boolean).join(" · ");
          const subSize = fit(room, sub.length, Math.round(15 * s), Math.round(20 * s));
          const avg = p.perTeamGame != null ? p.perTeamGame : p.avg;
          const tile = (label: string, value: string, w: number, size: number, key: string) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: w, height: tileH, borderRadius: 14, background: c.bg, color: c.fg, textShadow: c.shadow }}>
              <div style={{ display: "flex", fontSize: Math.round(15 * s), lineHeight: 1.1 }}>{label}</div>
              <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: size, lineHeight: 1.1 }}>{value}</div>
            </div>
          );
          return (
            <div key={p.overall} style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "3px solid #D5DEE8", borderRadius: 20, overflow: "hidden", height: rowH, flexShrink: 0 }}>
              <div style={{ display: "flex", width: 12, alignSelf: "stretch", background: c.bg }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, padding: "0 14px" }}>
                {variant === "keeper" ? null : <div style={{ display: "flex", width: pkW, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: Math.round(34 * s), lineHeight: 1, color: NAVY }}>{String(p.overall)}</div>}
                <PlayerAvatar name={p.name} src={p.playerId != null ? headshotUrl(p.playerId) : ""} hasHeadshot={p.playerId != null && headshots.has(p.playerId)} size={avatar} fontFamily={display} fontSize={Math.round(avatar * 0.36)} border="3px solid #D9A441" />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, color: NAVY, lineHeight: 1.05, whiteSpace: "nowrap" }}>{p.name}</div>
                    {tag ? <div style={{ display: "flex", padding: "2px 10px", borderRadius: 6, background: TAG_BG[tag] ?? MUTED, color: "#FFFFFF", fontSize: Math.round(15 * s), fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap" }}>{tag}</div> : null}
                  </div>
                  <div style={{ display: "flex", fontSize: subSize, color: MUTED, lineHeight: 1.1, whiteSpace: "nowrap" }}>{sub}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {variant === "value" ? tile("Current", p.finish != null ? `#${p.finish}` : "–", W_S, Math.round(32 * s), "c") : tile(p.perTeamGame != null ? "Per tm gm" : "Season", f2(avg), W_S, Math.round(32 * s), "s")}
                  {variant === "pick" ? tile("Total", f2(p.total), W_T, Math.round(30 * s), "t") : tile("VOR", f2(p.vor), W_T, Math.round(30 * s), "v")}
                  {variant === "value" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: W_TIER, height: tileH, borderRadius: 14, background: NAVY }}>
                      <div style={{ display: "flex", fontSize: Math.round(15 * s), lineHeight: 1.1, color: "#C9D6E6" }}>vs slot</div>
                      <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: Math.round(32 * s), lineHeight: 1.1, color: opts.valueUp ? "#7BE0A0" : "#FF8FA0" }}>{p.surplus != null ? signed(p.surplus) : "–"}</div>
                    </div>
                  ) : (
                    tile("Tier", p.tier ?? "N/A", W_TIER, fit(W_TIER - 16, (p.tier ?? "N/A").length, 16, Math.round(26 * s)), "r")
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}

// Every team's keepers ranked by combined keeper VOR, as the same light row cards.
export async function renderKeeperRankingCards(opts: { teams: KeeperTeam[]; footer?: string }) {
  const n = Math.max(1, opts.teams.length);
  const gap = 12;
  const rowH = Math.min(120, Math.floor((AVAIL - (n - 1) * gap) / n));
  const tileH = rowH - 24;
  const s = Math.min(1.25, rowH / 94);
  return frame({
    title: "Keeper Rankings",
    subtitle: "",
    footer: opts.footer,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {opts.teams.map((t, i) => {
          const room = 984 - 12 - 14 - 60 - 210 - 12 * 2 - 14 - 6;
          const nameSize = fit(room, t.team.length, Math.round(22 * s), Math.round(36 * s));
          const top = TIERS.find((x) => t.counts[x] > 0);
          const stripe = top ? TIER_STYLE[top].bg : "#D5DEE8";
          return (
            <div key={t.team} style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "3px solid #D5DEE8", borderRadius: 20, overflow: "hidden", height: rowH, flexShrink: 0 }}>
              <div style={{ display: "flex", width: 12, alignSelf: "stretch", background: stripe }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, padding: "0 14px" }}>
                <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: Math.round(40 * s), lineHeight: 1, color: i === 0 ? "#D9A441" : NAVY }}>{String(i + 1)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, color: NAVY, lineHeight: 1.05, whiteSpace: "nowrap" }}>{t.team}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {TIERS.filter((x) => t.counts[x] > 0).map((x) => (
                      <div key={x} style={{ display: "flex", padding: "2px 9px", borderRadius: 6, background: TIER_STYLE[x].bg, color: x === "Superstar" ? "#FFFFFF" : TIER_STYLE[x].fg, fontSize: Math.round(17 * s), fontWeight: 700, lineHeight: 1.15 }}>{`${t.counts[x]} ${x}`}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 210, height: tileH, borderRadius: 14, background: NAVY, color: "#FFFFFF" }}>
                  <div style={{ display: "flex", fontSize: Math.round(15 * s), lineHeight: 1.1, color: "#C9D6E6" }}>Keeper VOR</div>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: Math.round(34 * s), lineHeight: 1.1 }}>{signed(t.vor)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}

// Draft steals / busts / missed time as the same light cards.
export async function renderValueCards(opts: { kind: ValueKind; picks: AssessedPick[]; footer?: string; headshots?: Set<number> }) {
  return renderPickCards({ title: `Draft ${VALUE_TITLES[opts.kind]}`, subtitle: "Season VOR vs the player currently ranked at the pick's slot", picks: opts.picks, footer: opts.footer, headshots: opts.headshots, variant: "value", valueUp: opts.kind === "steals" });
}

// Every team's draft ranked and graded, as the same light row cards.
export async function renderDraftGradeCards(opts: { grades: DraftGrade[]; footer?: string }) {
  const n = Math.max(1, opts.grades.length);
  const gap = 12;
  const rowH = Math.min(120, Math.floor((AVAIL - (n - 1) * gap) / n));
  const tileH = rowH - 24;
  const s = Math.min(1.25, rowH / 94);
  const short = (x: string) => x.split(" ").slice(-1)[0];
  return frame({
    title: "Draft Grades",
    subtitle: "",
    footer: opts.footer,
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {opts.grades.map((g) => {
          const c = gradeColor(g.grade);
          const room = 984 - 12 - 14 - 60 - 128 - 100 - 12 * 3 - 14 - 6;
          const line = [g.best ? `Best: ${short(g.best.name)} ${signed(g.best.surplus)}` : "", g.worst ? `Worst: ${short(g.worst.name)} ${signed(g.worst.surplus)}` : ""].filter(Boolean).join("   ·   ");
          return (
            <div key={g.team} style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "3px solid #D5DEE8", borderRadius: 20, overflow: "hidden", height: rowH, flexShrink: 0 }}>
              <div style={{ display: "flex", width: 12, alignSelf: "stretch", background: c.bg }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, padding: "0 14px" }}>
                <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: Math.round(40 * s), lineHeight: 1, color: g.rank === 1 ? "#D9A441" : NAVY }}>{String(g.rank)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontSize: fit(room, g.team.length, Math.round(22 * s), Math.round(34 * s)), fontWeight: 700, color: NAVY, lineHeight: 1.05, whiteSpace: "nowrap" }}>{g.team}</div>
                  <div style={{ display: "flex", fontSize: fit(room, line.length, Math.round(14 * s), Math.round(18 * s)), color: MUTED, lineHeight: 1.1, whiteSpace: "nowrap" }}>{line}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 128, height: tileH, borderRadius: 14, background: NAVY, color: "#FFFFFF" }}>
                  <div style={{ display: "flex", fontSize: Math.round(14 * s), lineHeight: 1.1, color: "#C9D6E6" }}>vs avg</div>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: Math.round(30 * s), lineHeight: 1.1 }}>{signed(g.vsAvg)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 100, height: tileH, borderRadius: 14, background: c.bg, color: c.fg, fontFamily: display, fontWeight: 700, fontSize: Math.round(46 * s), lineHeight: 1 }}>{g.grade}</div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}
