// Server-side only. Never import this from a Client Component -- it reads
// ESPN_S2 / ESPN_SWID, which must stay off the client bundle entirely.
//
// ESPN has no official fantasy API. This uses the same undocumented
// endpoints that ESPN's own site and app call internally. It can change
// without notice; if a page suddenly looks wrong after an ESPN update,
// this is the first file to check.

import { Team, Matchup, Roster, LeagueMeta, WeeklyPlayerStat } from "./types";
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

// Every rostered player's ACTUAL fantasy points for one specific week --
// used to compute real "who actually had a big week" award suggestions,
// as opposed to season-to-date totals. statSourceId 0 = actual (not
// projected); scoringPeriodId lines up with the "week" numbers used
// everywhere else in this app.
export async function getWeeklyPlayerStats(
  week: number,
  season?: number
): Promise<{ players: WeeklyPlayerStat[]; live: boolean }> {
  // ESPN's roster response only includes season-aggregate stat buckets
  // (scoringPeriodId 0, split out by statSplitTypeId instead -- season
  // total, last-7-days, etc.) unless a specific scoringPeriodId is asked
  // for explicitly. Confirmed via the admin Roster Stats Probe: without
  // this, a past season's roster fetch never contains real per-week data
  // at all, no matter which week the code searches for afterward.
  const data = await fetchEspn(["mRoster", "mTeam"], season, false, `scoringPeriodId=${week}`);
  if (!data?.teams) {
    return { players: [], live: false };
  }

  const players: WeeklyPlayerStat[] = [];

  for (const t of data.teams) {
    for (const e of t.roster?.entries ?? []) {
      const player = e.playerPoolEntry?.player;
      if (!player) continue;

      const weekStat = (player.stats ?? []).find(
        (s: any) => s.scoringPeriodId === week && s.statSourceId === 0
      );
      if (!weekStat) continue; // player didn't play / no actual stats posted for this week yet

      players.push({
        id: player.id,
        name: player.fullName ?? "Unknown Player",
        position: positionName(player.defaultPositionId),
        teamId: t.id,
        points: weekStat.appliedTotal ?? 0,
      });
    }
  }

  return { players, live: true };
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
