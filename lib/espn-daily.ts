// Server-side only. Never import this from a Client Component -- it reads
// ESPN_S2 / ESPN_SWID.
//
// One scoring DAY of rostered-player stats, for the nightly blurbs. It lives
// in its own file (rather than inside lib/espn.ts) so that adding it can't
// disturb anything that already works; it talks to ESPN the same way
// lib/espn.ts does (same league, same cookies, same views).

import { MOCK_SEASON } from "@/data/mock-data";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

export function currentSeason(): number {
  return Number(process.env.ESPN_SEASON_YEAR || MOCK_SEASON);
}

// Never cached: the nightly job needs ESPN's final numbers, not a stale copy.
async function espnGet(views: string[], extra?: string, season: number = currentSeason()) {
  if (!ESPN_S2 || !ESPN_SWID) return null;
  const qs = views.map((v) => `view=${v}`).join("&") + (extra ? `&${extra}` : "");
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?${qs}`;
  try {
    const res = await fetch(url, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("ESPN daily fetch failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("ESPN daily fetch error", err);
    return null;
  }
}

export interface PeriodStatus {
  connected: boolean;
  current: number | null; // the scoring day ESPN considers "now"
  source: string | null; // which ESPN field it came from
  candidates: Record<string, number | null>; // every candidate field, for checking by eye
}

// ESPN's current scoring day. Reports every field it could have read from, so
// if "last night" ever lands on the wrong day the dry-run shows why.
export async function getCurrentScoringPeriod(): Promise<PeriodStatus> {
  const data = await espnGet(["mSettings", "mStatus"]);
  const num = (v: unknown) => {
    const n = Number(v);
    return v != null && Number.isFinite(n) && n > 0 ? n : null;
  };
  const candidates: Record<string, number | null> = {
    scoringPeriodId: num(data?.scoringPeriodId),
    "status.currentScoringPeriod": num(data?.status?.currentScoringPeriod),
    "status.latestScoringPeriod": num(data?.status?.latestScoringPeriod),
  };
  const source = Object.keys(candidates).find((k) => candidates[k] !== null) ?? null;
  return { connected: Boolean(data), current: source ? candidates[source] : null, source, candidates };
}

export interface DailyPlayerLine {
  id: number;
  name: string;
  position: string;
  teamId: number;
  slotId: number; // 7 = bench, 8 = IR, anything else = active lineup
  active: boolean; // false = the points did NOT count for the fantasy team
  points: number; // ESPN's applied fantasy points for that day
  stats?: Record<string, number>; // raw stat counts keyed by ESPN stat id
}

// ESPN lineup slots that don't score for the fantasy team (7 = Bench, 8 = IR),
// the same two lib/espn.ts skips.
const NON_SCORING_SLOTS = new Set([7, 8]);

function positionName(id?: number): string {
  const map: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
  return id !== undefined ? map[id] ?? "?" : "?";
}

// Every rostered player who actually has stats posted for ONE scoring day,
// benched and IR players included (flagged `active: false`). A player whose
// team didn't play that day has no stat entry and is simply absent.
export async function getDailyPlayerLines(sp: number, season: number = currentSeason()): Promise<{
  live: boolean;
  players: DailyPlayerLine[];
  teamNames: Record<number, string>;
  diag: { rosterEntries: number; withStats: number };
}> {
  // ESPN only includes per-day stats when scoringPeriodId is asked for explicitly.
  const data = await espnGet(["mRoster", "mTeam"], `scoringPeriodId=${sp}`, season);
  const diag = { rosterEntries: 0, withStats: 0 };
  if (!data?.teams) return { live: false, players: [], teamNames: {}, diag };

  const players: DailyPlayerLine[] = [];
  const teamNames: Record<number, string> = {};

  for (const t of data.teams) {
    teamNames[t.id] = t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev || `Team ${t.id}`;
    for (const e of t.roster?.entries ?? []) {
      const player = e.playerPoolEntry?.player;
      if (!player) continue;
      diag.rosterEntries++;
      const dayStat = (player.stats ?? []).find((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
      if (!dayStat) continue;
      diag.withStats++;
      players.push({
        id: player.id,
        name: player.fullName ?? "Unknown Player",
        position: positionName(player.defaultPositionId),
        teamId: t.id,
        slotId: e.lineupSlotId,
        active: !NON_SCORING_SLOTS.has(e.lineupSlotId),
        points: Number(dayStat.appliedTotal) || 0,
        stats: dayStat.stats && typeof dayStat.stats === "object" ? { ...dayStat.stats } : undefined,
      });
    }
  }

  return { live: true, players, teamNames, diag };
}

// ---- Probe: does ESPN still return day-by-day lineups for a PAST season? ----
// Diagnostic only (admin). For one season it asks for several scoring days and reports, for each, whether ESPN
// answered, how many players had a stat line for that day, and each team's total for it (active lineup only), so
// the totals can be checked against what ESPN showed at the time.
export interface DailyProbeDay {
  period: number;
  http: number | null;
  teams: number;
  rosterEntries: number;
  playersWithDayStats: number;
  activeWithDayStats: number;
  teamTotals: { teamId: number; name: string; points: number }[]; // top 3
  error?: string;
}

export async function probeDailySeason(season: number, periods: number[]): Promise<{ season: number; configured: boolean; days: DailyProbeDay[] }> {
  if (!ESPN_S2 || !ESPN_SWID) return { season, configured: false, days: [] };
  const days: DailyProbeDay[] = [];
  for (const sp of periods) {
    const day: DailyProbeDay = { period: sp, http: null, teams: 0, rosterEntries: 0, playersWithDayStats: 0, activeWithDayStats: 0, teamTotals: [] };
    try {
      const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mRoster&view=mTeam&scoringPeriodId=${sp}`;
      const res = await fetch(url, { headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` }, cache: "no-store" });
      day.http = res.status;
      if (res.ok) {
        const data = await res.json();
        const totals = new Map<number, { name: string; points: number }>();
        for (const t of data?.teams ?? []) {
          day.teams++;
          const name = t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || `Team ${t.id}`;
          for (const e of t.roster?.entries ?? []) {
            day.rosterEntries++;
            const dayStat = (e.playerPoolEntry?.player?.stats ?? []).find((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
            if (!dayStat) continue;
            day.playersWithDayStats++;
            if (NON_SCORING_SLOTS.has(e.lineupSlotId)) continue;
            day.activeWithDayStats++;
            const cur = totals.get(t.id) ?? { name, points: 0 };
            cur.points += Number(dayStat.appliedTotal) || 0;
            totals.set(t.id, cur);
          }
        }
        day.teamTotals = Array.from(totals, ([teamId, v]) => ({ teamId, name: v.name, points: Math.round(v.points * 100) / 100 }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 3);
      } else {
        day.error = (await res.text()).slice(0, 160);
      }
    } catch (err) {
      day.error = err instanceof Error ? err.message : String(err);
    }
    days.push(day);
  }
  return { season, configured: true, days };
}

// scoring day -> calendar date (Eastern, YYYY-MM-DD) for any season, from the NHL game dates ESPN lists per scoring day.
// `approx` is true when ESPN gave no dates and the dates are only estimated from October 1 of the season's start year.
export async function fetchPeriodDates(season: number): Promise<{ dates: Map<number, string>; maxPeriod: number; approx: boolean } | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;
  try {
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const earliest = new Map<number, number>(); // period -> earliest game start (ms)
    let maxPeriod = 0;
    for (const t of data?.settings?.proTeams ?? []) {
      for (const [k, games] of Object.entries(t?.proGamesByScoringPeriod ?? {})) {
        const sp = Number(k);
        if (!Number.isFinite(sp) || !Array.isArray(games) || games.length === 0) continue;
        maxPeriod = Math.max(maxPeriod, sp);
        for (const g of games as any[]) {
          const ms = Number(g?.date);
          if (Number.isFinite(ms) && ms > 0) earliest.set(sp, Math.min(earliest.get(sp) ?? Infinity, ms));
        }
      }
    }
    if (maxPeriod === 0) return null;
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const dates = new Map<number, string>();
    for (let sp = 1; sp <= maxPeriod; sp++) {
      const ms = earliest.get(sp);
      if (ms !== undefined) dates.set(sp, fmt.format(new Date(ms)));
      else {
        // a day with no games: step from the day before (or from Oct 1 for the very first day)
        const prev = dates.get(sp - 1);
        const base = prev ? new Date(`${prev}T12:00:00Z`) : new Date(Date.UTC(season - 1, 9, 1, 12));
        dates.set(sp, new Date(base.getTime() + (prev ? 86400000 : 0)).toISOString().slice(0, 10));
      }
    }
    return { dates, maxPeriod, approx: earliest.size === 0 };
  } catch {
    return null;
  }
}
