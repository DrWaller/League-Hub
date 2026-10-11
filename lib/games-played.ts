// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Games played and projected games for one matchup week, per fantasy team.
// ESPN doesn't show this; Yahoo does.
//
// A "game" is one starter-day: a player in an ACTIVE lineup slot (not bench / IR)
// on a day his NHL team plays.
//   - played    = the player has actual stats posted for that day (he got into the game)
//   - projected = today or a later day, no stats yet, his NHL team is scheduled to
//                 play, and he sits in an active slot in that day's saved lineup
// Lineups are read one scoring day at a time, so the projection reflects whatever
// lineup is currently saved for each remaining day.

import { getScoringPeriodsForWeek } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const ESPN_S2 = process.env.ESPN_S2;
const ESPN_SWID = process.env.ESPN_SWID;

// Same two slots lib/espn.ts treats as non-scoring: 7 = Bench, 8 = IR.
const NON_ACTIVE_SLOTS = new Set([7, 8]);

export interface TeamGamesPlayed {
  played: number;
  projected: number | null; // null = couldn't load the NHL schedule, so no projection
}

export type WeekGamesPlayed = Record<number, TeamGamesPlayed>;

function cookies() {
  return { Cookie: `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}` };
}

// Roster for one scoring day. Days before today are frozen, so cache them long.
async function fetchRosterDay(season: number, sp: number, frozen: boolean) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mRoster&view=mTeam&scoringPeriodId=${sp}`;
  try {
    const res = await fetch(url, { headers: cookies(), next: { revalidate: frozen ? 86400 : 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// proTeamId -> the scoring days that NHL team plays. ESPN publishes this on the
// game-level (not league-level) endpoint under settings.proTeams[].proGamesByScoringPeriod.
async function fetchProSchedule(season: number): Promise<Map<number, Set<number>> | null> {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`;
  try {
    const res = await fetch(url, { headers: cookies(), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const teams: any[] = data?.settings?.proTeams ?? [];
    const out = new Map<number, Set<number>>();
    for (const t of teams) {
      const games = t?.proGamesByScoringPeriod;
      if (!games || typeof games !== "object") continue;
      const days = new Set<number>();
      for (const [k, v] of Object.entries(games)) {
        if (Array.isArray(v) && v.length > 0 && Number.isFinite(Number(k))) days.add(Number(k));
      }
      out.set(Number(t.id), days);
    }
    return out.size > 0 ? out : null;
  } catch {
    return null;
  }
}

// Current season only. Returns null when ESPN isn't connected or the week's days
// can't be worked out, so the page can simply leave the numbers off.
export async function getWeekGamesPlayed(week: number, season: number): Promise<WeekGamesPlayed | null> {
  if (!ESPN_S2 || !ESPN_SWID) return null;

  let periods: number[];
  try {
    periods = (await getScoringPeriodsForWeek(week)).periods;
  } catch {
    return null;
  }
  if (periods.length === 0) return null;

  const status = await getCurrentScoringPeriod();
  const current = status.current;
  if (current === null) return null;

  const needsSchedule = periods.some((p) => p >= current);
  const [days, pro] = await Promise.all([
    Promise.all(periods.map((sp) => fetchRosterDay(season, sp, sp < current).then((data) => ({ sp, data })))),
    needsSchedule ? fetchProSchedule(season) : Promise.resolve(null),
  ]);

  if (!days.some((d) => d.data?.teams)) return null;

  const result: WeekGamesPlayed = {};
  const projectionAvailable = !needsSchedule || pro !== null;

  for (const { sp, data } of days) {
    for (const t of data?.teams ?? []) {
      const row = (result[t.id] ??= { played: 0, projected: projectionAvailable ? 0 : null });
      for (const e of t.roster?.entries ?? []) {
        if (NON_ACTIVE_SLOTS.has(e.lineupSlotId)) continue;
        const player = e.playerPoolEntry?.player;
        if (!player) continue;

        const hasStats = (player.stats ?? []).some((x: any) => x.scoringPeriodId === sp && x.statSourceId === 0);
        if (hasStats) {
          row.played++;
        } else if (sp >= current && pro && row.projected !== null) {
          if (pro.get(Number(player.proTeamId))?.has(sp)) row.projected++;
        }
      }
    }
  }

  return result;
}
