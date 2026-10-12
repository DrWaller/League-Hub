// Server-side only (reads the stored weekly VOR from Postgres). The season-long player award races: how the
// top players stand today and where they stood a week ago. Award names and rules live in PLAYER_AWARDS so
// they are easy to rename or redefine in one place.

import { getAllStored, type StoredVor } from "./vor-store";

export interface PlayerAward {
  key: string;
  title: string; // "Norris Trophy"
  watch: string; // graphic title, "Norris Watch"
  blurb: string;
  positions: string[];
  metric: "vor" | "points";
}

const ALL = ["C", "LW", "RW", "D", "G"];

export const PLAYER_AWARDS: PlayerAward[] = [
  { key: "hart", title: "Hart Trophy", watch: "Hart Watch", blurb: "Most valuable player: highest season VOR, any position.", positions: ALL, metric: "vor" },
  { key: "norris", title: "Norris Trophy", watch: "Norris Watch", blurb: "Best defenseman: highest season VOR among D.", positions: ["D"], metric: "vor" },
  { key: "vezina", title: "Vezina Trophy", watch: "Vezina Watch", blurb: "Best goalie: highest season VOR among G.", positions: ["G"], metric: "vor" },
  { key: "forward", title: "Forward of the Year", watch: "Forward Watch", blurb: "Best forward: highest season VOR among C, LW and RW.", positions: ["C", "LW", "RW"], metric: "vor" },
  { key: "artross", title: "Art Ross Trophy", watch: "Art Ross Watch", blurb: "Most fantasy points among skaters.", positions: ["C", "LW", "RW", "D"], metric: "points" },
];

export interface RaceEntry {
  id: number;
  name: string;
  position: string;
  teamId: number; // latest owner
  vor: number;
  points: number;
  rank: number;
  prevRank: number | null; // rank a week ago; null = was not ranked / no earlier week
}

export interface PlayerRace {
  award: PlayerAward;
  through: number; // last week counted
  entries: RaceEntry[];
}

interface Agg {
  id: number;
  name: string;
  position: string;
  teamId: number;
  vor: number;
  points: number;
}

function standings(rows: StoredVor[], award: PlayerAward, maxWeek: number): Agg[] {
  const by = new Map<number, Agg>();
  for (const r of rows) {
    if (r.week > maxWeek || !award.positions.includes(r.position)) continue;
    const a = by.get(r.playerId);
    if (a) {
      a.vor += r.vor;
      a.points += r.points;
      a.teamId = r.teamId; // rows run in week order: ends as the latest owner
    } else by.set(r.playerId, { id: r.playerId, name: r.name, position: r.position, teamId: r.teamId, vor: r.vor, points: r.points });
  }
  const key = (a: Agg) => (award.metric === "vor" ? a.vor : a.points);
  return [...by.values()].sort((a, b) => key(b) - key(a) || b.points - a.points);
}

export function buildRaces(rows: StoredVor[], throughWeek?: number, top = 5): PlayerRace[] {
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b).filter((w) => !throughWeek || w <= throughWeek);
  const through = weeks[weeks.length - 1] ?? 0;
  const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  return PLAYER_AWARDS.map((award) => {
    const now = standings(rows, award, through);
    const before = prev !== null ? new Map(standings(rows, award, prev).map((a, i) => [a.id, i + 1])) : null;
    return {
      award,
      through,
      entries: now.slice(0, top).map((a, i) => ({ ...a, rank: i + 1, prevRank: before ? before.get(a.id) ?? null : null })),
    };
  });
}

export async function getPlayerRaces(season: number, throughWeek?: number, top = 5): Promise<PlayerRace[]> {
  return buildRaces(await getAllStored(season), throughWeek, top);
}
