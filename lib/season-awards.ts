// Server-side only (reads the stored weekly VOR from Postgres). The season-long player award races: how the
// top players stand today and where they stood a week ago. Award names and rules live in PLAYER_AWARDS so
// they are easy to rename or redefine in one place.

import { getAllStored, type StoredVor } from "./vor-store";
import { sql } from "./db";

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

// ---------------------------------------------------------------------------------------------------------
// More year-long races: the goaltending tandem and the draft's biggest sleeper.

// Winners from earlier years, shown on each award's card.
export const PAST_WINNERS: Record<string, string[]> = {
  hart: ["2026: Nathan MacKinnon", "2025: Cale Makar", "2024: Nathan MacKinnon", "2023: Connor McDavid", "2022: Auston Matthews", "2021: Connor McDavid", "2020: David Pastrnak"],
  artross: ["2026: Nathan MacKinnon", "2025: Nathan MacKinnon", "2024: Nathan MacKinnon", "2023: Connor McDavid", "2022: Auston Matthews", "2021: Connor McDavid", "2020: David Pastrnak"],
  norris: ["2023: Erik Karlsson", "2022: Roman Josi"],
  vezina: ["2026: Connor Hellebuyck (manager vote)", "2023: Linus Ullmark", "2022: Jacob Markstrom"],
  calder: ["2026: Matthew Schaefer", "2025: Dustin Wolf", "2024: Connor Bedard", "2023: Logan Thompson", "2022: Moritz Seider", "2021: Kirill Kaprizov", "2020: Mackenzie Blackwood"],
  breakout: ["2026: Macklin Celebrini", "2025: Brandon Hagel", "2024: Evan Bouchard", "2023: Tage Thompson", "2022: Jack Hughes", "2021: Jakob Chychrun", "2020: JT Miller"],
  sleeping: ["2023: Linus Ullmark", "2022: Filip Forsberg"],
  improved: ["2023: Erik Karlsson", "2022: Matt Duchene"],
  jennings: ["2023: The Akibergs", "2022: DannyC DannyDo"],
};

export interface TandemEntry {
  teamId: number;
  points: number;
  goalies: { name: string; points: number }[];
  rank: number;
}

// The most dominant goaltending tandem: each team's two best goalies, by the fantasy points they scored while on
// that team's roster (started or not, the same way VOR counts points).
export function buildTandems(rows: StoredVor[], top = 5): TandemEntry[] {
  const byTeam = new Map<number, Map<number, { name: string; points: number }>>();
  for (const r of rows) {
    if (r.position !== "G") continue;
    const team = byTeam.get(r.teamId) ?? new Map<number, { name: string; points: number }>();
    const g = team.get(r.playerId);
    if (g) g.points += r.points;
    else team.set(r.playerId, { name: r.name, points: r.points });
    byTeam.set(r.teamId, team);
  }
  const list = [...byTeam.entries()].map(([teamId, goalies]) => {
    const best = [...goalies.values()].sort((a, b) => b.points - a.points).slice(0, 2);
    return { teamId, goalies: best, points: best.reduce((n, g) => n + g.points, 0) };
  });
  return list
    .sort((a, b) => b.points - a.points)
    .slice(0, top)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

export interface SleeperEntry {
  id: number;
  name: string;
  position: string;
  teamId: number;
  pick: number; // where he was drafted
  finish: number; // where he ranks by VOR among everyone drafted
  margin: number; // pick minus finish: bigger = more of a steal
  vor: number;
  rank: number;
}

// Sleeping Beauty: the drafted player who out-produced his draft slot by the most. His finish is his rank by
// season VOR among every drafted player (VOR so goalies and skaters sit on one scale); keeper picks are not real
// draft slots, so they are only used as comparisons.
export async function getSleepingBeauty(season: number, top = 5): Promise<SleeperEntry[]> {
  const picks = await sql`
    SELECT overall_pick, player_id, player_name, position, team_id, is_keeper FROM draft_picks WHERE season = ${season} AND source = 'espn';
  `;
  if (picks.rows.length === 0) return [];
  const vorBy = new Map<number, number>();
  for (const r of await getAllStored(season)) vorBy.set(r.playerId, (vorBy.get(r.playerId) ?? 0) + r.vor);
  const drafted = picks.rows
    .map((p) => ({ id: Number(p.player_id), name: String(p.player_name), position: String(p.position), teamId: Number(p.team_id), pick: Number(p.overall_pick), keeper: Boolean(p.is_keeper) }))
    .filter((p) => vorBy.has(p.id));
  const order = [...drafted].sort((a, b) => (vorBy.get(b.id) ?? 0) - (vorBy.get(a.id) ?? 0));
  const finish = new Map(order.map((p, i) => [p.id, i + 1]));
  return drafted
    .filter((p) => !p.keeper)
    .map((p) => ({ ...p, finish: finish.get(p.id) ?? 0, margin: p.pick - (finish.get(p.id) ?? 0), vor: vorBy.get(p.id) ?? 0 }))
    .filter((p) => p.margin > 0)
    .sort((a, b) => b.margin - a.margin || b.vor - a.vor)
    .slice(0, top)
    .map((p, i) => ({ id: p.id, name: p.name, position: p.position, teamId: p.teamId, pick: p.pick, finish: p.finish, margin: p.margin, vor: p.vor, rank: i + 1 }));
}
