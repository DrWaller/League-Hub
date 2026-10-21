// Server-side only (slot counts come from ESPN). Pure lineup maths shared by the lineup-efficiency report
// ("max pts") and the matchup projections (ideal lineup for the days still to come).
import type { Pos } from "@/lib/vor";

const FORWARDS: Pos[] = ["C", "LW", "RW"];
const SKATERS: Pos[] = ["C", "LW", "RW", "D"];

export type SlotCounts = Record<"C" | "LW" | "RW" | "F" | "D" | "G" | "Util", number>;

// Best possible lineup from one day's players. Pure function (easy to test).
export function bestDayLineup(
  players: { id: number; position: Pos; points: number }[],
  slots: SlotCounts
): { total: number; chosen: Set<number> } {
  const chosen = new Set<number>();
  let total = 0;
  const take = (eligible: Pos[], n: number) => {
    const cands = players.filter((p) => !chosen.has(p.id) && eligible.includes(p.position)).sort((a, b) => b.points - a.points);
    for (const p of cands.slice(0, Math.max(0, n))) {
      chosen.add(p.id);
      total += p.points;
    }
  };
  take(["C"], slots.C);
  take(["LW"], slots.LW);
  take(["RW"], slots.RW);
  take(["D"], slots.D);
  take(["G"], slots.G);
  take(FORWARDS, slots.F);
  take(SKATERS, slots.Util);
  return { total, chosen };
}

// The league's real starting slots (ESPN ids: 0 C, 1 LW, 2 RW, 3 F, 4 D, 5 G, 6 Util). null = couldn't load.
export async function fetchSlotCounts(season: number): Promise<SlotCounts | null> {
  const leagueId = process.env.ESPN_LEAGUE_ID || "78683444";
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings`;
  try {
    const res = await fetch(url, {
      headers: { Cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const counts = (await res.json())?.settings?.rosterSettings?.lineupSlotCounts;
    if (!counts || typeof counts !== "object") return null;
    const n = (id: number) => Number(counts[id]) || 0;
    return { C: n(0), LW: n(1), RW: n(2), F: n(3), D: n(4), G: n(5), Util: n(6) };
  } catch {
    return null;
  }
}
