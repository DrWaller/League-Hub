// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Value over replacement (VOR) for one matchup week, across every position.
//
//   points      = ALL of the fantasy points a rostered player scored that week, whether or not his
//                 owner had him in a starting slot (it measures how good he was, not how well he was used)
//   replacement = per position, the weekly score of the LAST player who would be starting at that
//                 position if every team started its best players. Built from the league's real
//                 lineup slots, including flex (F / Util) slots, by filling slots league-wide.
//   VOR         = points - replacement[position]
//
// A goalie scoring 14 and a forward scoring 14 are not worth the same, because replacement level
// differs by position; VOR puts them on one scale.

import { getScoringPeriodsForWeek } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { fetchRosterDay } from "@/lib/games-played";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

export type Pos = "C" | "LW" | "RW" | "D" | "G";
const POS_BY_ID: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const FORWARDS: Pos[] = ["C", "LW", "RW"];
const SKATERS: Pos[] = ["C", "LW", "RW", "D"];

// ESPN hockey lineup slot ids: 0 C, 1 LW, 2 RW, 3 F (any forward), 4 D, 5 G, 6 Util (any skater), 7 bench, 8 IR.
const SLOT = { C: 0, LW: 1, RW: 2, F: 3, D: 4, G: 5, UTIL: 6 };

export interface VorPlayer {
  id: number;
  name: string;
  position: Pos;
  teamId: number; // the fantasy team he was last on that week
  points: number;
  gamesPlayed: number; // days he has stats posted
  replacement: number;
  vor: number;
  starter: boolean; // would be in the league-wide best lineup
}

export interface WeekVor {
  week: number;
  season: number;
  teamCount: number;
  slots: Record<string, number>; // how many of each slot a team starts
  replacement: Record<Pos, number>;
  players: VorPlayer[]; // sorted by VOR, best first
}

async function fetchLineupSlots(season: number): Promise<Record<number, number> | null> {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mSettings`;
  try {
    const res = await fetch(url, { headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` }, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const counts = data?.settings?.rosterSettings?.lineupSlotCounts;
    if (!counts || typeof counts !== "object") return null;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(counts)) out[Number(k)] = Number(v) || 0;
    return out;
  } catch {
    return null;
  }
}

// Fill the league's starting slots from a pool, best score first: dedicated position slots, then
// F (any forward), then Util (any skater). Returns the players chosen.
function pickStarters(pool: VorPlayer[], teamCount: number, counts: Record<number, number>): Set<number> {
  const taken = new Set<number>();
  const take = (eligible: Pos[], n: number) => {
    const cands = pool.filter((p) => !taken.has(p.id) && eligible.includes(p.position)).sort((a, b) => b.points - a.points);
    for (const p of cands.slice(0, Math.max(0, n))) taken.add(p.id);
  };
  take(["C"], teamCount * (counts[SLOT.C] ?? 0));
  take(["LW"], teamCount * (counts[SLOT.LW] ?? 0));
  take(["RW"], teamCount * (counts[SLOT.RW] ?? 0));
  take(["D"], teamCount * (counts[SLOT.D] ?? 0));
  take(["G"], teamCount * (counts[SLOT.G] ?? 0));
  take(FORWARDS, teamCount * (counts[SLOT.F] ?? 0));
  take(SKATERS, teamCount * (counts[SLOT.UTIL] ?? 0));
  return taken;
}

// Current season by default; pass a past season to rank a finished week of an ESPN season.
export async function getWeekVor(week: number, season: number, currentSeason: number): Promise<WeekVor | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;

  let periods: number[];
  try {
    periods = (await getScoringPeriodsForWeek(week, season === currentSeason ? undefined : season)).periods;
  } catch {
    return null;
  }
  if (periods.length === 0) return null;

  const isCurrent = season === currentSeason;
  const current = isCurrent ? (await getCurrentScoringPeriod()).current : null;

  const [days, counts] = await Promise.all([
    Promise.all(periods.map((sp) => fetchRosterDay(season, sp, !isCurrent || (current != null && sp < current)).then((data) => ({ sp, data })))),
    fetchLineupSlots(season),
  ]);
  if (!counts || !days.some((d) => d.data?.teams)) return null;

  const teamIds = new Set<number>();
  const byPlayer = new Map<number, VorPlayer>();

  for (const { sp, data } of days) {
    for (const t of data?.teams ?? []) {
      teamIds.add(t.id);
      for (const e of t.roster?.entries ?? []) {
        const pl = e.playerPoolEntry?.player;
        if (!pl) continue;
        const pos = POS_BY_ID[pl.defaultPositionId];
        if (!pos) continue;
        const dayStat = (pl.stats ?? []).find((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
        if (!dayStat) continue; // his team didn't play, or he didn't dress: no points that day

        const pts = Number(dayStat.appliedTotal) || 0;
        const existing = byPlayer.get(pl.id);
        if (existing) {
          existing.points += pts;
          existing.gamesPlayed++;
          existing.teamId = t.id; // days run in order, so this ends as the latest owner
        } else {
          byPlayer.set(pl.id, {
            id: pl.id,
            name: pl.fullName ?? "Unknown Player",
            position: pos,
            teamId: t.id,
            points: pts,
            gamesPlayed: 1,
            replacement: 0,
            vor: 0,
            starter: false,
          });
        }
      }
    }
  }

  const pool = [...byPlayer.values()];
  if (pool.length === 0) return null;

  const teamCount = teamIds.size;
  const starters = pickStarters(pool, teamCount, counts);

  // Replacement level: the lowest score among players who made the league-wide lineup, per position.
  const replacement = {} as Record<Pos, number>;
  for (const pos of ["C", "LW", "RW", "D", "G"] as Pos[]) {
    const scores = pool.filter((p) => p.position === pos && starters.has(p.id)).map((p) => p.points);
    replacement[pos] = scores.length ? Math.min(...scores) : 0;
  }

  for (const p of pool) {
    p.replacement = replacement[p.position];
    p.vor = Math.round((p.points - p.replacement) * 100) / 100;
    p.starter = starters.has(p.id);
  }
  pool.sort((a, b) => b.vor - a.vor || b.points - a.points);

  return {
    week,
    season,
    teamCount,
    slots: { C: counts[SLOT.C] ?? 0, LW: counts[SLOT.LW] ?? 0, RW: counts[SLOT.RW] ?? 0, F: counts[SLOT.F] ?? 0, D: counts[SLOT.D] ?? 0, G: counts[SLOT.G] ?? 0, Util: counts[SLOT.UTIL] ?? 0 },
    replacement,
    players: pool,
  };
}
