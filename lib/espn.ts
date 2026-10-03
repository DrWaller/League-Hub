// Server-side only. Never import this from a Client Component -- it reads
// ESPN_S2 / ESPN_SWID, which must stay off the client bundle entirely.
//
// ESPN has no official fantasy API. This uses the same undocumented
// endpoints that ESPN's own site and app call internally. It can change
// without notice; if a page suddenly looks wrong after an ESPN update,
// this is the first file to check.

import { Team, Matchup, Roster, LeagueMeta, WeeklyPlayerStat } from "./types";
import { getWeekCalendar, periodsForWeek } from "./week-calendar";
import type { PoolPlayer, Group } from "./radar";
import {
  MOCK_TEAMS,
  MOCK_MATCHUPS,
  MOCK_ROSTERS,
  MOCK_LEAGUE_NAME,
  MOCK_LEAGUE_SIZE,
  MOCK_CURRENT_WEEK,
  MOCK_SEASON,
} from "@/data/mock-data";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const SEASON = process.env.ESPN_SEASON_YEAR || String(MOCK_SEASON);
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

function buildBase(season?: number | string) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season ?? SEASON}/segments/0/leagues/${LEAGUE_ID}`;
}

export function liveDataConfigured(): boolean {
  return Boolean(ESPN_S2 && ESPN_SWID);
}

async function fetchEspn(views: string[], season?: number, quiet = false, extraParams?: string) {
  if (!liveDataConfigured()) return null;

  const qs = views.map((v) => `view=${v}`).join("&") + (extraParams ? `&${extraParams}` : "");
  try {
    const res = await fetch(`${buildBase(season)}?${qs}`, {
      headers: {
        Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`,
      },
      // Standings/rosters change during the day; don't cache too long.
      // Past seasons are frozen, so cache those far longer.
      next: { revalidate: season ? 86400 : 300 },
    });
    if (!res.ok) {
      if (!quiet) console.error("ESPN fetch failed", res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    if (!quiet) console.error("ESPN fetch error", err);
    return null;
  }
}

export async function getLeagueMeta(): Promise<LeagueMeta> {
  const data = await fetchEspn(["mSettings", "mStatus"]);
  if (!data) {
    return {
      name: MOCK_LEAGUE_NAME,
      size: MOCK_LEAGUE_SIZE,
      currentWeek: MOCK_CURRENT_WEEK,
      season: MOCK_SEASON,
      liveDataConnected: false,
    };
  }
  return {
    name: data?.settings?.name ?? MOCK_LEAGUE_NAME,
    size: data?.settings?.size ?? MOCK_LEAGUE_SIZE,
    currentWeek: data?.status?.currentMatchupPeriod ?? MOCK_CURRENT_WEEK,
    season: Number(SEASON),
    liveDataConnected: true,
  };
}

export async function getStandings(): Promise<{ teams: Team[]; live: boolean }> {
  const data = await fetchEspn(["mTeam"]);
  if (!data?.teams) {
    return { teams: MOCK_TEAMS, live: false };
  }

  const teams: Team[] = data.teams.map((t: any) => ({
    id: t.id,
    name: t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev,
    abbrev: t.abbrev,
    logo: t.logo,
    wins: t.record?.overall?.wins ?? 0,
    losses: t.record?.overall?.losses ?? 0,
    ties: t.record?.overall?.ties ?? 0,
    pointsFor: t.record?.overall?.pointsFor ?? 0,
    pointsAgainst: t.record?.overall?.pointsAgainst ?? 0,
    streak:
      t.record?.overall?.streakLength && t.record?.overall?.streakType
        ? `${t.record.overall.streakType === "WIN" ? "W" : "L"}${t.record.overall.streakLength}`
        : undefined,
  }));

  teams.sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.pointsFor - a.pointsFor);

  return { teams, live: true };
}

export async function getMatchups(
  week?: number,
  season?: number
): Promise<{ matchups: Matchup[]; live: boolean }> {
  const data = await fetchEspn(["mMatchup", "mMatchupScore"], season);
  if (!data?.schedule) {
    // A specific historical season was requested and failed -- don't
    // substitute the current season's mock data, that would be misleading.
    if (season) return { matchups: [], live: false };
    return { matchups: MOCK_MATCHUPS.filter((m) => !week || m.week === week), live: false };
  }

  const matchups: Matchup[] = data.schedule
    // A playoff bye shows up as an entry with only one team -- skip it.
    .filter((m: any) => m.home?.teamId != null && m.away?.teamId != null)
    .filter((m: any) => !week || m.matchupPeriodId === week)
    .map((m: any) => ({
      week: m.matchupPeriodId,
      homeTeamId: m.home.teamId,
      homeScore: m.home?.totalPoints ?? 0,
      awayTeamId: m.away.teamId,
      awayScore: m.away?.totalPoints ?? 0,
      isFinal: Boolean(m.winner && m.winner !== "UNDECIDED"),
      // ESPN marks postseason games with a playoffTierType other than NONE.
      isPlayoff: Boolean(m.playoffTierType && m.playoffTierType !== "NONE"),
    }));

  return { matchups, live: true };
}

export async function getRosters(season?: number): Promise<{ rosters: Roster[]; live: boolean }> {
  const data = await fetchEspn(["mRoster", "mTeam"], season);
  if (!data?.teams) {
    if (season) return { rosters: [], live: false };
    return { rosters: MOCK_ROSTERS, live: false };
  }

  const rosters: Roster[] = data.teams.map((t: any) => ({
    teamId: t.id,
    players: (t.roster?.entries ?? []).map((e: any) => ({
      id: e.playerPoolEntry?.player?.id ?? e.playerId,
      name: e.playerPoolEntry?.player?.fullName ?? "Unknown Player",
      position: positionName(e.playerPoolEntry?.player?.defaultPositionId),
      proTeam: e.playerPoolEntry?.player?.proTeamId ? String(e.playerPoolEntry.player.proTeamId) : "",
      points: e.playerPoolEntry?.player?.stats?.[0]?.appliedTotal ?? 0,
    })),
  }));

  return { rosters, live: true };
}

// Which ESPN scoring periods (days) make up a matchup week. In fantasy hockey
// a scoringPeriodId is ONE DAY and a matchup week spans roughly seven of
// them, so "week 4" is NOT scoringPeriodId 4.
//
// The days come from the schedule itself: each matchup carries
// pointsByScoringPeriod, keyed by the scoring days it covered.
// (scheduleSettings.matchupPeriods in the league settings is NOT usable for
// this -- it maps matchup periods to other MATCHUP periods, e.g. a two-week
// playoff round, so it just says "week 4 = [4]".)
// If the schedule has no day breakdown, it falls back to the week lengths saved
// in lib/week-calendar.ts; for a daily league with nothing saved it throws
// rather than quietly using one night as a "week".
export async function getScoringPeriodsForWeek(
  week: number,
  season?: number
): Promise<{ periods: number[]; source: string; scheduleSettingsKeys: string[] }> {
  const [settings, sched] = await Promise.all([
    fetchEspn(["mSettings", "mStatus"], season, true),
    fetchEspn(["mMatchup", "mMatchupScore"], season, true),
  ]);
  const ss = settings?.settings?.scheduleSettings;
  const scheduleSettingsKeys = ss && typeof ss === "object" ? Object.keys(ss) : [];

  const days = new Set<number>();
  for (const m of sched?.schedule ?? []) {
    if (m.matchupPeriodId !== week) continue;
    for (const side of [m.home, m.away]) {
      for (const k of Object.keys(side?.pointsByScoringPeriod ?? {})) {
        const n = Number(k);
        if (Number.isFinite(n)) days.add(n);
      }
    }
  }
  if (days.size > 0) {
    return { periods: Array.from(days).sort((a, b) => a - b), source: "schedule.pointsByScoringPeriod", scheduleSettingsKeys };
  }

  // ESPN gave no day breakdown: use the week lengths the commissioner entered at /admin/week-days.
  const cal = await getWeekCalendar(season ?? Number(SEASON));
  const saved = cal ? periodsForWeek(cal.lengths, week) : null;
  if (saved) return { periods: saved, source: "saved week calendar", scheduleSettingsKeys };

  // Nothing saved. A weekly league (one scoring period per matchup) can safely use [week];
  // a daily one must not, or one night would be reported as a whole week.
  const first = Number(settings?.status?.firstScoringPeriod);
  const last = Number(settings?.status?.finalScoringPeriod);
  const weeks = Number(ss?.matchupPeriodCount);
  const looksDaily = Number.isFinite(first) && Number.isFinite(last) && weeks > 0 && last - first + 1 > weeks * 1.5;
  if (looksDaily) {
    throw new Error(
      `This league scores daily, and ESPN doesn't say which days belong to week ${week}. Open Week Days in the admin (/admin/week-days), enter how many days each week has (copy it from ESPN's schedule page) and save. It's a one-time setup per season.`
    );
  }

  return { periods: [week], source: "fallback (weekly league: week = scoring period)", scheduleSettingsKeys };
}

// How many teams make the playoffs (league setting); 6 if ESPN doesn't say.
export async function getPlayoffTeamCount(season?: number): Promise<number> {
  const data = await fetchEspn(["mSettings"], season, true);
  const n = Number(data?.settings?.scheduleSettings?.playoffTeamCount);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

// What the Week Days admin page needs to pre-fill itself.
export async function getCalendarFacts(season?: number) {
  const [meta, sched] = await Promise.all([
    fetchEspn(["mSettings", "mStatus"], season, true),
    fetchEspn(["mMatchup", "mMatchupScore"], season, true),
  ]);
  let maxPeriod = 0;
  for (const m of sched?.schedule ?? []) maxPeriod = Math.max(maxPeriod, Number(m.matchupPeriodId) || 0);
  return {
    connected: Boolean(meta),
    matchupPeriodCount: Number(meta?.settings?.scheduleSettings?.matchupPeriodCount) || null,
    maxMatchupPeriod: maxPeriod || null,
    firstScoringPeriod: Number(meta?.status?.firstScoringPeriod) || 1,
    finalScoringPeriod: Number(meta?.status?.finalScoringPeriod) || null,
  };
}

// Diagnostic: what ESPN says about scoring days vs matchup weeks, so the
// mapping can be checked by eye. Opened at /api/admin/period-probe.
export async function getPeriodProbe(season?: number) {
  const [meta, sched] = await Promise.all([
    fetchEspn(["mSettings", "mStatus"], season, true),
    fetchEspn(["mMatchup", "mMatchupScore"], season, true),
  ]);
  const ss = meta?.settings?.scheduleSettings ?? {};
  const byPeriod: Record<string, { matchups: number; daysSeen: number[] }> = {};
  for (const m of sched?.schedule ?? []) {
    const key = String(m.matchupPeriodId);
    const entry = (byPeriod[key] ??= { matchups: 0, daysSeen: [] });
    entry.matchups++;
    for (const side of [m.home, m.away]) {
      for (const k of Object.keys(side?.pointsByScoringPeriod ?? {})) {
        const n = Number(k);
        if (Number.isFinite(n) && !entry.daysSeen.includes(n)) entry.daysSeen.push(n);
      }
    }
  }
  for (const e of Object.values(byPeriod)) e.daysSeen.sort((a, b) => a - b);
  const keys = Object.keys(byPeriod).sort((a, b) => Number(a) - Number(b));
  return {
    connected: Boolean(meta),
    status: {
      currentScoringPeriod: meta?.status?.currentScoringPeriod ?? meta?.scoringPeriodId ?? null,
      currentMatchupPeriod: meta?.status?.currentMatchupPeriod ?? null,
      firstScoringPeriod: meta?.status?.firstScoringPeriod ?? null,
      finalScoringPeriod: meta?.status?.finalScoringPeriod ?? null,
    },
    scheduleSettings: {
      matchupPeriodCount: ss.matchupPeriodCount ?? null,
      matchupPeriodLength: ss.matchupPeriodLength ?? null,
      periodTypeId: ss.periodTypeId ?? null,
      matchupPeriodsFirstFive: Object.fromEntries(Object.entries(ss.matchupPeriods ?? {}).slice(0, 5)),
    },
    scheduleFirstFiveMatchupPeriods: Object.fromEntries(keys.slice(0, 5).map((k) => [k, byPeriod[k]])),
  };
}

// ESPN lineup slots that don't score for the fantasy team (per the
// community espn-api hockey constants: 7 = Bench, 8 = IR).
const NON_SCORING_SLOTS = new Set([7, 8]);

// Every rostered player's ACTUAL fantasy points for one matchup week: their
// daily scores summed across every scoring day in that week, counting only
// days they were in an active lineup slot. statSourceId 0 = actual (not
// projected). Raw stat counts (goals, assists, ...) are summed the same way.
export async function getWeeklyPlayerStats(
  week: number,
  season?: number
): Promise<{ players: WeeklyPlayerStat[]; live: boolean; scoringPeriods?: number[]; diag?: Record<string, unknown> }> {
  const mapping = await getScoringPeriodsForWeek(week, season);
  const scoringPeriods = mapping.periods;

  // ESPN's roster response only includes season-aggregate stat buckets
  // unless a specific scoringPeriodId is asked for explicitly (confirmed via
  // the admin Roster Stats Probe), so each day is its own request.
  const days = await Promise.all(
    scoringPeriods.map((sp) => fetchEspn(["mRoster", "mTeam"], season, false, `scoringPeriodId=${sp}`).then((data) => ({ sp, data })))
  );

  if (!days.some((d) => d.data?.teams)) {
    return { players: [], live: false };
  }

  const byPlayer = new Map<number, WeeklyPlayerStat>();
  // Counters that explain an empty result (shown by the Player Spotlight route).
  const diag = {
    mappingSource: mapping.source,
    scheduleSettingsKeys: mapping.scheduleSettingsKeys,
    daysRequested: scoringPeriods.length,
    daysThatReturnedTeams: days.filter((d) => d.data?.teams).length,
    rosterEntries: 0,
    skippedBenchOrIR: 0,
    noActualStatForThatDay: 0,
    scoringPeriodIdsSeenOnPlayers: [] as number[],
    slotIdsSeen: [] as number[],
  };
  const seenSp = new Set<number>();
  const seenSlots = new Set<number>();

  for (const { sp, data } of days) {
    for (const t of data?.teams ?? []) {
      for (const e of t.roster?.entries ?? []) {
        const player = e.playerPoolEntry?.player;
        if (!player) continue;
        diag.rosterEntries++;
        seenSlots.add(e.lineupSlotId);
        for (const x of player.stats ?? []) if (x.statSourceId === 0) seenSp.add(x.scoringPeriodId);
        if (NON_SCORING_SLOTS.has(e.lineupSlotId)) {
          diag.skippedBenchOrIR++; // benched / IR that day
          continue;
        }

        const dayStat = (player.stats ?? []).find(
          (x: any) => x.scoringPeriodId === sp && x.statSourceId === 0
        );
        if (!dayStat) {
          diag.noActualStatForThatDay++; // didn't play that day / no actual stats posted yet
          continue;
        }

        const existing = byPlayer.get(player.id);
        const dayStats: Record<string, number> | undefined =
          dayStat.stats && typeof dayStat.stats === "object" ? dayStat.stats : undefined;

        if (!existing) {
          byPlayer.set(player.id, {
            id: player.id,
            name: player.fullName ?? "Unknown Player",
            position: positionName(player.defaultPositionId),
            teamId: t.id,
            points: dayStat.appliedTotal ?? 0,
            stats: dayStats ? { ...dayStats } : undefined,
          });
        } else {
          existing.points += dayStat.appliedTotal ?? 0;
          existing.teamId = t.id; // days are processed in order, so this ends as the latest team
          if (dayStats) {
            existing.stats = existing.stats ?? {};
            for (const [k, v] of Object.entries(dayStats)) {
              existing.stats[k] = (existing.stats[k] ?? 0) + Number(v);
            }
          }
        }
      }
    }
  }

  diag.scoringPeriodIdsSeenOnPlayers = Array.from(seenSp).sort((a, b) => a - b).slice(0, 60);
  diag.slotIdsSeen = Array.from(seenSlots).sort((a, b) => a - b);
  return { players: Array.from(byPlayer.values()), live: true, scoringPeriods, diag };
}

// Diagnostic only -- for a given season+week, fetches player roster stats
// TWO ways: the normal way (no scoringPeriodId in the request -- what
// getWeeklyPlayerStats actually does today) and with an explicit
// scoringPeriodId added to the request. Reports what came back from each,
// so a real mismatch (e.g. a past season simply not returning full stats
// history the normal way) shows up directly instead of being guessed at.
export interface RosterStatsProbe {
  ok: boolean;
  totalEntries: number;
  entriesWithAnyStats: number;
  scoringPeriodIdsSeen: number[];
  statSourceIdsSeen: number[];
  matchingRequestedWeek: number; // entries with scoringPeriodId === week && statSourceId === 0 (what the real code looks for)
  samplePlayer: { name: string; statsArrayLength: number; sampleStats: unknown[] } | null;
}

async function probeRosterStats(season: number, week: number, withScoringPeriod: boolean): Promise<RosterStatsProbe> {
  if (!liveDataConfigured()) {
    return { ok: false, totalEntries: 0, entriesWithAnyStats: 0, scoringPeriodIdsSeen: [], statSourceIdsSeen: [], matchingRequestedWeek: 0, samplePlayer: null };
  }
  const qs = withScoringPeriod
    ? `view=mRoster&view=mTeam&scoringPeriodId=${week}`
    : `view=mRoster&view=mTeam`;
  const data = await fetch(`${buildBase(season)}?${qs}`, {
    headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` },
    next: { revalidate: 0 },
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  if (!data?.teams) return { ok: false, totalEntries: 0, entriesWithAnyStats: 0, scoringPeriodIdsSeen: [], statSourceIdsSeen: [], matchingRequestedWeek: 0, samplePlayer: null };

  let total = 0;
  let withStats = 0;
  let matching = 0;
  const periods = new Set<number>();
  const sources = new Set<number>();
  let sample: RosterStatsProbe["samplePlayer"] = null;

  for (const t of data.teams) {
    for (const e of t.roster?.entries ?? []) {
      const player = e.playerPoolEntry?.player;
      if (!player) continue;
      total++;
      const stats = player.stats ?? [];
      if (stats.length > 0) {
        withStats++;
        if (!sample) sample = { name: player.fullName ?? "?", statsArrayLength: stats.length, sampleStats: stats.slice(0, 3) };
      }
      for (const s of stats) {
        if (typeof s.scoringPeriodId === "number") periods.add(s.scoringPeriodId);
        if (typeof s.statSourceId === "number") sources.add(s.statSourceId);
        if (s.scoringPeriodId === week && s.statSourceId === 0) matching++;
      }
    }
  }

  return {
    ok: true,
    totalEntries: total,
    entriesWithAnyStats: withStats,
    scoringPeriodIdsSeen: Array.from(periods).sort((a, b) => a - b),
    statSourceIdsSeen: Array.from(sources).sort((a, b) => a - b),
    matchingRequestedWeek: matching,
    samplePlayer: sample,
  };
}

export async function diagnoseRosterStats(season: number, week: number) {
  const [withoutPeriod, withPeriod] = await Promise.all([
    probeRosterStats(season, week, false),
    probeRosterStats(season, week, true),
  ]);
  return { season, week, withoutScoringPeriodParam: withoutPeriod, withScoringPeriodParam: withPeriod };
}

// names/ids for that year, and owner info if present. Whether historical
// data goes back this far, and whether owner names are included, varies
// and isn't something that can be verified without a live request -- this
// is meant to be inspected in the admin UI, not relied on blindly.
export async function getHistoricalSeasonTeams(season: number): Promise<{
  ok: boolean;
  error?: string;
  teams?: {
    id: number;
    abbrev: string;
    name: string;
    ownerIds: string[];
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
  }[];
  members?: { id: string; displayName: string }[];
}> {
  if (!liveDataConfigured()) {
    return { ok: false, error: "ESPN isn't connected (missing ESPN_S2 / ESPN_SWID)." };
  }

  const url = `${buildBase(season)}?view=mTeam&view=mSettings`;

  try {
    const res = await fetch(url, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, error: `ESPN returned ${res.status}. It may not have data this far back.` };
    }

    const data = await res.json();

    const teams = (data.teams ?? []).map((t: any) => ({
      id: t.id,
      abbrev: t.abbrev,
      name: t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim(),
      ownerIds: t.owners ?? [],
      wins: t.record?.overall?.wins ?? 0,
      losses: t.record?.overall?.losses ?? 0,
      ties: t.record?.overall?.ties ?? 0,
      pointsFor: t.record?.overall?.pointsFor ?? 0,
      pointsAgainst: t.record?.overall?.pointsAgainst ?? 0,
    }));

    const members = (data.members ?? []).map((m: any) => ({
      id: m.id,
      displayName: m.displayName || `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(),
    }));

    return { ok: true, teams, members };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Sums real fantasy points per player across a range of weeks (inclusive)
// -- used for Monthly Awards' "Suggest from stats" button. Straightforward
// aggregation over the same weekly function already used for Weekly Awards.
export async function getMonthlyPlayerStats(
  startWeek: number,
  endWeek: number,
  season?: number
): Promise<{ players: WeeklyPlayerStat[]; live: boolean }> {
  const totals = new Map<number, WeeklyPlayerStat>();
  let anyLive = false;

  for (let week = startWeek; week <= endWeek; week++) {
    const { players, live } = await getWeeklyPlayerStats(week, season);
    if (live) anyLive = true;
    for (const p of players) {
      const existing = totals.get(p.id);
      if (existing) {
        existing.points += p.points;
      } else {
        totals.set(p.id, { ...p });
      }
    }
  }

  return { players: Array.from(totals.values()), live: anyLive };
}

export interface ManagerMonthSummary {
  teamId: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

// Tallies each team's actual matchup results across a range of weeks --
// this is what makes "Manager of the Month" an objective, auto-computed
// fact rather than an editorial pick, unlike the player awards above.
export async function getManagerMonthSummary(
  startWeek: number,
  endWeek: number,
  season?: number
): Promise<{ teams: ManagerMonthSummary[]; live: boolean }> {
  const totals = new Map<number, ManagerMonthSummary>();
  let anyLive = false;

  const ensure = (teamId: number) => {
    if (!totals.has(teamId)) {
      totals.set(teamId, { teamId, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    return totals.get(teamId)!;
  };

  for (let week = startWeek; week <= endWeek; week++) {
    const { matchups, live } = await getMatchups(week, season);
    if (live) anyLive = true;
    for (const m of matchups) {
      if (!m.isFinal) continue;
      const home = ensure(m.homeTeamId);
      const away = ensure(m.awayTeamId);
      home.pointsFor += m.homeScore;
      home.pointsAgainst += m.awayScore;
      away.pointsFor += m.awayScore;
      away.pointsAgainst += m.homeScore;
      if (m.homeScore > m.awayScore) {
        home.wins++;
        away.losses++;
      } else if (m.awayScore > m.homeScore) {
        away.wins++;
        home.losses++;
      } else {
        home.ties++;
        away.ties++;
      }
    }
  }

  return { teams: Array.from(totals.values()), live: anyLive };
}

function positionName(id?: number): string {
  const map: Record<number, string> = {
    1: "C",
    2: "LW",
    3: "RW",
    4: "D",
    5: "G",
  };
  return id !== undefined ? map[id] ?? "?" : "?";
}


// ---------------------------------------------------------------------------
// Past seasons, discovered from ESPN itself (no import needed)
// ---------------------------------------------------------------------------

export interface PastSeasonTeam {
  id: number;
  abbrev: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

// One team list per past season, cached a day (past seasons don't change).
// Returns null when ESPN has nothing for that year -- which is exactly how
// a season the league didn't play on ESPN (e.g. the Fantrax year) shows up.
export async function getPastSeasonTeams(season: number): Promise<PastSeasonTeam[] | null> {
  const data = await fetchEspn(["mTeam"], season, true);
  if (!data?.teams?.length) return null;
  return data.teams.map((t: any) => ({
    id: t.id,
    abbrev: t.abbrev,
    name: t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev,
    wins: t.record?.overall?.wins ?? 0,
    losses: t.record?.overall?.losses ?? 0,
    ties: t.record?.overall?.ties ?? 0,
    pointsFor: t.record?.overall?.pointsFor ?? 0,
    pointsAgainst: t.record?.overall?.pointsAgainst ?? 0,
  }));
}

// Which earlier seasons does ESPN actually have for this league? Asks about
// each of the last several years and keeps the ones that answer with teams.
// Remembered for a few hours per server instance so it isn't re-asked on
// every page view.
let seasonProbe: { current: number; at: number; seasons: number[] } | null = null;
const PROBE_YEARS = 12;

export async function getPastSeasons(currentSeason: number): Promise<number[]> {
  if (!liveDataConfigured()) return [];
  if (seasonProbe && seasonProbe.current === currentSeason && Date.now() - seasonProbe.at < 6 * 3600 * 1000) {
    return seasonProbe.seasons;
  }
  const years = Array.from({ length: PROBE_YEARS }, (_, i) => currentSeason - 1 - i);
  const answers = await Promise.all(years.map((y) => getPastSeasonTeams(y).then((t) => (t ? y : null))));
  const seasons = answers.filter((y): y is number => y !== null).sort((a, b) => b - a);
  seasonProbe = { current: currentSeason, at: Date.now(), seasons };
  return seasons;
}


// ---------------------------------------------------------------- NHL player pool (Player Radar)
// ESPN's player-pool view lists every NHL player (owned or not) with season stats.
// It's filtered by a JSON header; see the filters below.

async function fetchPool(filter: object, season?: number) {
  if (!liveDataConfigured()) return null;
  try {
    const res = await fetch(`${buildBase(season)}?view=kona_player_info`, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`, "x-fantasy-filter": JSON.stringify(filter) },
      next: { revalidate: season ? 86400 : 1800 },
    });
    if (!res.ok) {
      console.error("ESPN player pool fetch failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("ESPN player pool fetch error", err);
    return null;
  }
}

export async function fetchPoolRaw(filter: object, season?: number): Promise<{ status: number | null; data: any | null; snippet: string }> {
  if (!liveDataConfigured()) return { status: null, data: null, snippet: "ESPN login cookies are not configured" };
  try {
    const res = await fetch(`${buildBase(season)}?view=kona_player_info`, {
      headers: { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`, "x-fantasy-filter": JSON.stringify(filter) },
      cache: "no-store",
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, data: res.ok ? data : null, snippet: res.ok ? "" : text.slice(0, 200) };
  } catch (err) {
    return { status: null, data: null, snippet: String(err).slice(0, 200) };
  }
}

export interface PoolAttempt {
  filter: string;
  status: number | null;
  entries: number;
  usable: number;
  note: string;
}

// One player by id. Tries a few filter shapes (ESPN is picky about which combinations
// it accepts) and reports what each returned, so a failure explains itself.
export async function getPlayerByIdDiag(id: number, season?: number): Promise<{ player: PoolPlayer | null; attempts: PoolAttempt[] }> {
  const seasonId = season ?? Number(SEASON);
  const stats = { filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: [`00${seasonId}`] } };
  const shapes: { name: string; filter: object }[] = [
    { name: "ids + season stats", filter: { players: { filterIds: { value: [id] }, ...stats, limit: 5 } } },
    { name: "ids + all statuses + season stats", filter: { players: { filterIds: { value: [id] }, filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] }, ...stats, limit: 5 } } },
    { name: "ids only", filter: { players: { filterIds: { value: [id] }, limit: 5 } } },
  ];
  const attempts: PoolAttempt[] = [];
  for (const sh of shapes) {
    const r = await fetchPoolRaw(sh.filter, season);
    const raw: any[] = Array.isArray(r.data?.players) ? r.data.players : [];
    const mapped = raw.map((e) => toPoolPlayer(e, seasonId)).filter((x): x is PoolPlayer => x !== null);
    let note = r.snippet;
    if (raw.length > 0 && mapped.length === 0) {
      const seen = ((raw[0]?.player?.stats ?? []) as any[]).map((x) => `${x.id}(src${x.statSourceId},split${x.statSplitTypeId})`).slice(0, 8);
      note = `player found but no season-to-date stats entry. Stat entries seen: ${seen.join(", ") || "none"}`;
    }
    attempts.push({ filter: sh.name, status: r.status, entries: raw.length, usable: mapped.length, note });
    if (mapped.length > 0) return { player: mapped.find((p) => p.id === id) ?? mapped[0], attempts };
  }
  return { player: null, attempts };
}

export function toPoolPlayer(entry: any, seasonId: number): PoolPlayer | null {
  const pl = entry?.player ?? entry?.playerPoolEntry?.player;
  if (!pl || pl.id == null) return null;
  const stats: any[] = pl.stats ?? [];
  // The season-to-date line: actual (not projected) stats, whole-season split.
  const total =
    stats.find((x) => x.statSourceId === 0 && x.statSplitTypeId === 0 && (String(x.id) === `00${seasonId}` || x.seasonId === seasonId)) ??
    stats.find((x) => x.statSourceId === 0 && x.statSplitTypeId === 0) ??
    stats.find((x) => String(x.id) === `00${seasonId}`);
  if (!total) return null;
  const st: Record<string, number> = total.stats && typeof total.stats === "object" ? total.stats : {};
  const gp = Number(st["34"]) || Number(st["0"]) || 0; // games played, or games started for goalies
  return {
    id: pl.id,
    name: pl.fullName ?? "Unknown Player",
    positionId: pl.defaultPositionId ?? 0,
    proTeamId: pl.proTeamId ?? 0,
    gp,
    stats: st,
    appliedTotal: Number(total.appliedTotal) || 0,
  };
}

const POOL_FILTER_BASE = (seasonId: number) => ({
  filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] },
  filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: [`00${seasonId}`] },
});

// The fantasy-relevant NHL players of one position group: the most-owned first.
export async function getPlayerPool(group: Group, season?: number): Promise<PoolPlayer[]> {
  const seasonId = season ?? Number(SEASON);
  const slots = group === "F" ? [0, 1, 2] : group === "D" ? [4] : [5];
  const limit = group === "F" ? 700 : group === "D" ? 350 : 160;
  const data = await fetchPool(
    { players: { ...POOL_FILTER_BASE(seasonId), filterSlotIds: { value: slots }, limit, sortPercOwned: { sortPriority: 1, sortAsc: false } } },
    season
  );
  return ((data?.players ?? []) as any[]).map((e) => toPoolPlayer(e, seasonId)).filter((x): x is PoolPlayer => x !== null);
}

export async function getPlayersById(ids: number[], season?: number): Promise<PoolPlayer[]> {
  const seasonId = season ?? Number(SEASON);
  const data = await fetchPool({ players: { ...POOL_FILTER_BASE(seasonId), filterIds: { value: ids }, limit: ids.length } }, season);
  return ((data?.players ?? []) as any[]).map((e) => toPoolPlayer(e, seasonId)).filter((x): x is PoolPlayer => x !== null);
}

// Name search for the picker (most-owned matches first).
export async function searchPlayers(query: string, season?: number): Promise<PoolPlayer[]> {
  const seasonId = season ?? Number(SEASON);
  const data = await fetchPool(
    { players: { ...POOL_FILTER_BASE(seasonId), filterName: { value: query }, limit: 8, sortPercOwned: { sortPriority: 1, sortAsc: false } } },
    season
  );
  return ((data?.players ?? []) as any[]).map((e) => toPoolPlayer(e, seasonId)).filter((x): x is PoolPlayer => x !== null);
}

// The league's scoring categories: [{ statId, points }]. Negative points = lower is better.
export async function getScoringItems(season?: number): Promise<{ statId: number; points: number }[]> {
  const data = await fetchEspn(["mSettings"], season, true);
  const items = data?.settings?.scoringSettings?.scoringItems;
  if (!Array.isArray(items)) return [];
  return items.map((i: any) => ({ statId: Number(i.statId), points: Number(i.points) || 0 })).filter((i) => Number.isFinite(i.statId));
}
