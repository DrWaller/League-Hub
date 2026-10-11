// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Best available players for the waiver wire: every player nobody owns (free agents and players on
// waivers), scored by value over replacement (VOR) over the season and the last 7 / 15 / 30 days,
// plus which upcoming days his NHL team plays.
//
// VOR for any stretch of games = points - (replacement points per game at his position x games played),
// the same bar the weekly VOR uses (see lib/vor.ts).

import { getLeagueMeta } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { getReplacementRates, type Pos } from "@/lib/vor";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

const POS_BY_ID: Record<number, Pos> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const DAYS_AHEAD = 14;

// ESPN's NHL team ids, used only when ESPN's schedule response doesn't carry abbreviations.
const NHL_ABBREV: Record<number, string> = {
  1: "BOS", 2: "BUF", 3: "CGY", 4: "CHI", 5: "DET", 6: "EDM", 7: "CAR", 8: "LA", 9: "DAL", 10: "MTL", 11: "NJ", 12: "NYI", 13: "NYR", 14: "OTT",
  15: "PHI", 16: "PIT", 17: "COL", 18: "SJ", 19: "STL", 20: "TB", 21: "TOR", 22: "VAN", 23: "WSH", 24: "WPG", 25: "FLA", 26: "CBJ", 27: "MIN",
  28: "NSH", 29: "ANA", 30: "UTA", 37: "VGK", 124292: "SEA", 129764: "UTA",
};

export type Window = "season" | "l7" | "l15" | "l30";
const WINDOW_PREFIX: Record<Window, string> = { season: "00", l7: "01", l15: "02", l30: "03" };

export interface WindowStat {
  pts: number;
  gp: number;
  avg: number;
  vor: number | null; // null when replacement level couldn't be worked out
}

export interface AvailablePlayer {
  id: number;
  name: string;
  position: Pos;
  team: string; // NHL team abbreviation
  status: "FA" | "W"; // free agent, or on waivers
  owned: number | null; // % owned across ESPN
  injury: string | null; // null when healthy
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
}

const cookies = () => ({ Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` });
const base = (season: number) => `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;

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
async function fetchProTeams(season: number): Promise<Map<number, { abbrev: string; days: Set<number> }> | null> {
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

function windowStat(stats: any[], prefix: string, season: number, pos: Pos, rates: Record<Pos, number> | null): WindowStat | null {
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
  };
}

export async function getBestAvailable(): Promise<BestAvailable | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;
  const meta = await getLeagueMeta();
  const season = meta.season;

  const [raw, pro, status, rates] = await Promise.all([
    fetchFreeAgents(season),
    fetchProTeams(season),
    getCurrentScoringPeriod(),
    getReplacementRates(season, meta.currentWeek).catch(() => null),
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

  const players: AvailablePlayer[] = [];
  for (const e of raw) {
    const pl = e?.player ?? e?.playerPoolEntry?.player;
    const pos = POS_BY_ID[pl?.defaultPositionId];
    if (!pl || pl.id == null || !pos) continue;
    const stats: any[] = pl.stats ?? [];
    const w = {} as Record<Window, WindowStat | null>;
    for (const k of Object.keys(WINDOW_PREFIX) as Window[]) w[k] = windowStat(stats, WINDOW_PREFIX[k], season, pos, rates);
    const proId = Number(pl.proTeamId);
    const team = pro?.get(proId)?.abbrev ?? NHL_ABBREV[proId] ?? "FA";
    const games: number[] = [];
    if (scheduleKnown) {
      const sched = pro!.get(proId)?.days;
      if (sched) for (let i = 0; i < DAYS_AHEAD; i++) if (sched.has((current as number) + i)) games.push(i);
    }
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
      games,
      w,
    });
  }

  // Drop players with no games at all this season, unless nobody has played yet.
  const played = players.filter((p) => (p.w.season?.gp ?? 0) > 0 || (p.w.l30?.gp ?? 0) > 0);
  const list = played.length > 0 ? played : players;
  const teams = Array.from(new Set(list.map((p) => p.team))).sort();
  return { season, rates, scheduleKnown, days, teams, players: list };
}
