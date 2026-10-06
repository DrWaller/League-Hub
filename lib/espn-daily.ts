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
async function espnGet(views: string[], extra?: string) {
  if (!ESPN_S2 || !ESPN_SWID) return null;
  const qs = views.map((v) => `view=${v}`).join("&") + (extra ? `&${extra}` : "");
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${currentSeason()}/segments/0/leagues/${LEAGUE_ID}?${qs}`;
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
export async function getDailyPlayerLines(sp: number): Promise<{
  live: boolean;
  players: DailyPlayerLine[];
  teamNames: Record<number, string>;
  diag: { rosterEntries: number; withStats: number };
}> {
  // ESPN only includes per-day stats when scoringPeriodId is asked for explicitly.
  const data = await espnGet(["mRoster", "mTeam"], `scoringPeriodId=${sp}`);
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
