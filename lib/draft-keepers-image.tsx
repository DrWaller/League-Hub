import { frame } from "./portrait-graphics";
import { TIER_STYLE, TIERS, type Tier } from "./tier-style";

// Portrait (1080 x 1350) graphic ranking every team's keepers: rank, team, tier chips and the combined season VOR of
// the team's keepers. Satori: every element with more than one child needs display:flex.

export interface KeeperTeam {
  team: string;
  vor: number;
  counts: Record<Tier, number>;
  names: string[]; // keeper last names, best first
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
const fit = (room: number, chars: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(room / (Math.max(1, chars) * 0.5))));

export async function renderKeeperRanking(opts: { teams: KeeperTeam[]; footer?: string }) {
  const n = Math.max(1, opts.teams.length);
  const rowH = Math.min(104, Math.floor((1094 - 24 - 40 - (n - 1) * 8) / n));
  return frame({
    dark: true,
    flush: true,
    footer: opts.footer,
    title: "Keeper Rankings",
    subtitle: "",
    body: ({ display }) => (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "10px 28px 14px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 40, gap: 14, padding: "0 18px", fontFamily: display, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: "#9FB3C8" }}>
          <div style={{ display: "flex", width: 60, justifyContent: "center" }}>#</div>
          <div style={{ display: "flex", flexGrow: 1 }}>TEAM</div>
          <div style={{ display: "flex", width: 190, justifyContent: "flex-end" }}>KEEPER VOR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.teams.map((t, i) => {
            const room = 1024 - 36 - 60 - 190 - 14 * 3;
            const nameSize = fit(room, t.team.length, 24, 40);
            return (
              <div key={t.team} style={{ display: "flex", alignItems: "center", gap: 14, height: rowH, flexShrink: 0, padding: "0 18px", borderRadius: 14, background: "#1B3A5C", color: "#FFFFFF" }}>
                <div style={{ display: "flex", width: 60, justifyContent: "center", fontFamily: display, fontWeight: 700, fontSize: 40, lineHeight: 1, color: i === 0 ? "#D9A441" : "#FFFFFF" }}>{String(i + 1)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", fontFamily: display, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, whiteSpace: "nowrap" }}>{t.team}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {TIERS.filter((x) => t.counts[x] > 0).map((x) => (
                      <div key={x} style={{ display: "flex", padding: "2px 9px", borderRadius: 6, background: TIER_STYLE[x].bg, color: x === "Superstar" ? "#FFFFFF" : TIER_STYLE[x].fg, fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{`${t.counts[x]} ${x}`}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", width: 190, justifyContent: "flex-end", fontFamily: display, fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{signed(t.vor)}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}
