// Server-side only. How many games each NHL team plays in the fantasy regular season, read from ESPN's NHL
// schedule, so goalie projections use the games that are really left rather than a flat 82.
import { getLeagueMeta } from "@/lib/espn";
import { getWeekCalendar } from "@/lib/week-calendar";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "78683444";
const cookies = () => ({ Cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}` });

export interface SeasonGames {
  endPeriod: number | null; // last scoring day of the fantasy regular season (null: the whole NHL schedule)
  total: Map<string, number>; // team abbreviation -> games in the fantasy season
  average: number; // typical team's games in the fantasy season
  remaining: Map<string, number>; // team abbreviation -> games left from the given scoring day (today included) to the end
}

async function matchupCount(season: number): Promise<number | null> {
  try {
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mSettings`, { headers: cookies(), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const n = Number((await res.json())?.settings?.scheduleSettings?.matchupPeriodCount);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function getSeasonGames(fromPeriod?: number | null): Promise<SeasonGames | null> {
  const season = (await getLeagueMeta()).season;
  try {
    const [res, cal, count] = await Promise.all([
      fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`, { headers: cookies(), next: { revalidate: 3600 } }),
      getWeekCalendar(season).catch(() => null),
      matchupCount(season),
    ]);
    if (!res.ok) return null;
    const teams: any[] = ((await res.json())?.settings?.proTeams ?? []).filter((t: any) => Number(t.id) > 0 && t.proGamesByScoringPeriod);
    if (teams.length === 0) return null;
    // Regular season = the first matchupPeriodCount weeks of the commissioner's week calendar.
    let endPeriod: number | null = null;
    if (cal && cal.lengths.length > 0 && count && count <= cal.lengths.length) endPeriod = cal.lengths.slice(0, count).reduce((a, b) => a + b, 0);
    const total = new Map<string, number>();
    const remaining = new Map<string, number>();
    for (const t of teams) {
      let n = 0;
      let left = 0;
      for (const [k, v] of Object.entries(t.proGamesByScoringPeriod ?? {})) {
        if (Array.isArray(v) && v.length > 0 && (endPeriod === null || Number(k) <= endPeriod)) {
          n++;
          if (fromPeriod != null && Number(k) >= fromPeriod) left++;
        }
      }
      total.set(String(t.abbrev ?? "").toUpperCase(), n);
      remaining.set(String(t.abbrev ?? "").toUpperCase(), left);
    }
    const vals = Array.from(total.values()).filter((n) => n > 0);
    if (vals.length === 0) return null;
    return { endPeriod, total, average: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), remaining };
  } catch {
    return null;
  }
}
