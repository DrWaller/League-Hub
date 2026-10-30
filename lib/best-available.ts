// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Best available players for the waiver wire: every player nobody owns (free agents and players on
// waivers), scored by value over replacement (VOR) over the season and the last 7 / 15 / 30 days,
// plus which upcoming days his NHL team plays.
//
// VOR for any stretch of games = points - (replacement points per game at his position x games played),
// the same bar the weekly VOR uses (see lib/vor.ts).

import type { Tier } from "@/lib/tier-style";
import { getLeagueMeta, getScoringItems } from "@/lib/espn";
import { STAT_META } from "@/lib/espn-stats";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { getReplacementRates, type Pos } from "@/lib/vor";
import type { Usage } from "@/lib/nhl-usage";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

export const POS_BY_ID: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
export const DAYS_AHEAD = 21;

// ESPN's NHL team ids, used only when ESPN's schedule response doesn't carry abbreviations.
export const NHL_ABBREV: Record<number, string> = {
  1: "BOS", 2: "BUF", 3: "CGY", 4: "CHI", 5: "DET", 6: "EDM", 7: "CAR", 8: "LA", 9: "DAL", 10: "MTL", 11: "NJ", 12: "NYI", 13: "NYR", 14: "OTT",
  15: "PHI", 16: "PIT", 17: "COL", 18: "SJ", 19: "STL", 20: "TB", 21: "TOR", 22: "VAN", 23: "WSH", 24: "WPG", 25: "FLA", 26: "CBJ", 27: "MIN",
  28: "NSH", 29: "ANA", 30: "UTA", 37: "VGK", 124292: "SEA", 129764: "UTA",
};

export type Window = "season" | "l7" | "l15" | "l30";
export const WINDOW_PREFIX: Record<Window, string> = { season: "00", l7: "01", l15: "02", l30: "03" };

export interface WindowStat {
  pts: number;
  gp: number;
  avg: number;
  vor: number | null; // null when replacement level couldn't be worked out
  st: Record<string, number>; // raw counts for each scoring stat (only the non-zero ones)
}

// A stat the league scores for, shown as a column.
export interface StatCat {
  id: string;
  label: string;
  goalie: boolean;
  rate: boolean; // already a rate (SV%, GAA, ATOI), so shown as-is
  higherIsBetter: boolean;
}

// Column order: scoring, then physical, then the rest; goalies after.
export const ORDER = ["13", "14", "37", "38", "18", "19", "39", "20", "21", "29", "31", "32", "22", "28", "15", "17", "35", "36", "33", "23", "24", "27", "0", "1", "2", "6", "3", "4", "11", "10", "7", "9", "8"];
export const rank = (id: string) => (ORDER.indexOf(id) === -1 ? 999 : ORDER.indexOf(id));

export interface AvailablePlayer {
  tier?: Tier | null; // league tier (added by the page from lib/tier-index)
  id: number;
  name: string;
  position: Pos;
  team: string; // NHL team abbreviation
  status: "FA" | "W"; // free agent, or on waivers
  owned: number | null; // % owned across ESPN
  injury: string | null; // null when healthy
  proj: number | null; // ESPN's projected points per game, when it sends one
  role?: Usage | null; // line, power-play unit and ice time (added by the page, not by getBestAvailable)
  games: number[]; // days-from-today (0 = today) his NHL team plays, within the next DAYS_AHEAD days
  w: Record<Window, WindowStat | null>;
}

export interface BestAvailable {
  season: number;
  rates: Record<Pos, number> | null;
  scheduleKnown: boolean;
  days: { offset: number; date: string; label: string }[];
  teams: string[];
  players: AvailablePlayer[];
  cats: StatCat[]; // the league's scoring stats
}

export const cookies = () => ({ Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` });
export const base = (season: number) => `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;

async function fetchFreeAgents(season: number): Promise<any[] | null> {
  const ids = (Object.values(WINDOW_PREFIX) as string[]).map((p) => `${p}${season}`);
  const shape = (withStats: boolean) => ({
    players: {
      filterStatus: { value: ["FREEAGENT", "WAIVERS"] },
      filterSlotIds: { value: [0, 1, 2, 4, 5] },
      ...(withStats ? { filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: ids } } : {}),
      sortPercOwned: { sortPriority: 1, sortAsc: false },
      limit: 500,
    },
  });
  for (const withStats of [true, false]) {
    try {
      const res = await fetch(`${base(season)}?view=kona_player_info`, {
        headers: { ...cookies(), "x-fantasy-filter": JSON.stringify(shape(withStats)) },
        next: { revalidate: 600 },
      });
      if (!res.ok) {
        console.error("Best available fetch failed", res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data?.players) && data.players.length > 0) return data.players;
    } catch (err) {
      console.error("Best available fetch error", err);
    }
  }
  return null;
}

// NHL team id -> abbreviation and the scoring days it plays (game-level endpoint, not league-level).
export async function fetchProTeams(season: number): Promise<Map<number, { abbrev: string; days: Set<number> }> | null> {
  try {
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`, {
      headers: cookies(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = new Map<number, { abbrev: string; days: Set<number> }>();
    for (const t of data?.settings?.proTeams ?? []) {
      const days = new Set<number>();
      for (const [k, v] of Object.entries(t?.proGamesByScoringPeriod ?? {})) {
        if (Array.isArray(v) && v.length > 0 && Number.isFinite(Number(k))) days.add(Number(k));
      }
      const id = Number(t.id);
      out.set(id, { abbrev: String(t.abbrev ?? NHL_ABBREV[id] ?? `T${id}`).toUpperCase(), days });
    }
    return out.size > 0 ? out : null;
  } catch {
    return null;
  }
}

export function windowStat(stats: any[], prefix: string, season: number, pos: Pos, rates: Record<Pos, number> | null, catIds: string[]): WindowStat | null {
  const x = stats.find((s) => s.statSourceId === 0 && String(s.id) === `${prefix}${season}`);
  if (!x) return null;
  const pts = Number(x.appliedTotal);
  if (!Number.isFinite(pts)) return null;
  let gp = Number(x.stats?.["34"]) || Number(x.stats?.["0"]) || 0;
  const avg = Number(x.appliedAverage);
  if (!gp && avg > 0) gp = Math.round(pts / avg);
  return {
    pts: Math.round(pts * 100) / 100,
    gp,
    avg: gp > 0 ? Math.round((pts / gp) * 100) / 100 : 0,
    vor: rates ? Math.round((pts - rates[pos] * gp) * 100) / 100 : null,
    st: Object.fromEntries(catIds.map((id) => [id, Number(x.stats?.[id])] as const).filter(([, v]) => Number.isFinite(v) && v !== 0)),
  };
}

export async function getBestAvailable(): Promise<BestAvailable | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;
  const meta = await getLeagueMeta();
  const season = meta.season;

  const [raw, pro, status, rates, items] = await Promise.all([
    fetchFreeAgents(season),
    fetchProTeams(season),
    getCurrentScoringPeriod(),
    getReplacementRates(season, meta.currentWeek).catch(() => null),
    getScoringItems().catch(() => []),
  ]);
  if (!raw) return null;

  // Upcoming days. Scoring day N = today when N is ESPN's current day, so dates follow from that.
  const current = status.current;
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days: BestAvailable["days"] = [];
  if (current !== null) {
    const t0 = new Date(`${todayET}T00:00:00Z`).getTime();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(t0 + i * 86400000);
      days.push({
        offset: i,
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
      });
    }
  }
  const scheduleKnown = pro !== null && current !== null;

  // The league's scoring stats (games played, id 34, isn't one to show: GP has its own column).
  const cats: StatCat[] = [];
  for (const it of items) {
    const id = String(it.statId);
    if (!it.points || id === "34" || cats.some((c) => c.id === id)) continue;
    const meta2 = STAT_META[id];
    cats.push({ id, label: meta2?.label ?? `Stat ${id}`, goalie: Boolean(meta2?.goalie), rate: Boolean(meta2?.rate), higherIsBetter: it.points > 0 });
  }
  cats.sort((a, b) => rank(a.id) - rank(b.id));
  const catIds = cats.map((c) => c.id);

  const players: AvailablePlayer[] = [];
  for (const e of raw) {
    const pl = e?.player ?? e?.playerPoolEntry?.player;
    const pos = POS_BY_ID[pl?.defaultPositionId];
    if (!pl || pl.id == null || !pos) continue;
    const stats: any[] = pl.stats ?? [];
    const w = {} as Record<Window, WindowStat | null>;
    for (const k of Object.keys(WINDOW_PREFIX) as Window[]) w[k] = windowStat(stats, WINDOW_PREFIX[k], season, pos, rates, catIds);
    const proId = Number(pl.proTeamId);
    const team = pro?.get(proId)?.abbrev ?? NHL_ABBREV[proId] ?? "FA";
    const games: number[] = [];
    if (scheduleKnown) {
      const sched = pro!.get(proId)?.days;
      if (sched) for (let i = 0; i < DAYS_AHEAD; i++) if (sched.has((current as number) + i)) games.push(i);
    }
    const projEntry = stats.find((x) => x.statSourceId === 1 && x.statSplitTypeId === 0 && !x.scoringPeriodId);
    const projGp = Number(projEntry?.stats?.["34"]) || Number(projEntry?.stats?.["0"]) || 0;
    const projTotal = Number(projEntry?.appliedTotal);
    const proj = projEntry && projGp > 0 && Number.isFinite(projTotal) ? projTotal / projGp : null;
    const inj = String(pl.injuryStatus ?? "ACTIVE");
    const owned = Number(pl.ownership?.percentOwned);
    players.push({
      id: pl.id,
      name: pl.fullName ?? "Unknown Player",
      position: pos,
      team,
      status: String(e.status ?? "").toUpperCase() === "WAIVERS" ? "W" : "FA",
      owned: Number.isFinite(owned) ? owned : null,
      injury: inj === "ACTIVE" ? null : inj.replace(/_/g, " ").toLowerCase(),
      proj,
      games,
      w,
    });
  }

  // Drop players with no games at all this season, unless nobody has played yet.
  const played = players.filter((p) => (p.w.season?.gp ?? 0) > 0 || (p.w.l30?.gp ?? 0) > 0);
  const list = played.length > 0 ? played : players;
  const teams = Array.from(new Set(list.map((p) => p.team))).sort();
  return { season, rates, scheduleKnown, days, teams, players: list, cats };
}
