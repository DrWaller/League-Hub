// Server-side only. The NHL game grid: every NHL team by day, which nights are light (8 or fewer games
// league-wide, Frozen Pool's rule), each team's games and off-night games, and the free agents on each team.

import { getLeagueMeta, getScoringPeriodsForWeek } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { getBestAvailable, NHL_ABBREV } from "@/lib/best-available";
import { getOpenSlots, type OpenSlots } from "@/lib/pickups";
import { getStandings } from "@/lib/espn";

const LIGHT_DAY_GAMES = 8;

export interface GridDay {
  label: string;
  games: number; // NHL games that night
  light: boolean;
}
export interface GridCell {
  game: boolean;
  opp?: string; // opponent abbreviation, when ESPN says who it is
  away?: boolean;
}
export interface GridTeam {
  abbrev: string;
  cells: GridCell[];
  gp: number;
  off: number; // games on light nights
  score: number; // interim schedule rating, higher is better
}
export interface GridPlayer {
  id: number;
  name: string;
  position: string;
  team: string;
  status: "FA" | "W";
  owned: number | null;
  injury: string | null;
  gp: number;
  pts: number;
  avg: number;
  vor: number | null;
  fits: number[]; // day columns where he plays and fills a spot that's open on my team
}
export interface GridData {
  days: GridDay[];
  teams: GridTeam[];
  players: GridPlayer[];
  week: number;
  maxWeek: number;
  from: string;
  to: string;
  teamId: number;
  teamName: string;
  teamOptions: { id: number; name: string }[];
  open: OpenSlots[] | null; // my empty starting slots per day, when a team is chosen
}

// One fantasy matchup week: the scoring days ESPN's matchup schedule assigns to it.
export async function getGameGrid(week: number | null, teamId: number | null): Promise<GridData | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const status = await getCurrentScoringPeriod();
  if (status.current === null) return null;
  const maxWeek = 30;
  const wk = Math.max(1, Math.min(maxWeek, week ?? meta.currentWeek));
  let periods: number[];
  try {
    periods = (await getScoringPeriodsForWeek(wk)).periods;
  } catch {
    return null;
  }
  if (periods.length === 0) return null;
  const span = periods.length;

  let data: any;
  try {
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/${season}?view=proTeamSchedules_wl`, {
      headers: { Cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }
  const proTeams: any[] = (data?.settings?.proTeams ?? []).filter((t: any) => Number(t.id) > 0 && t.proGamesByScoringPeriod);
  if (proTeams.length === 0) return null;

  const abbrevOf = new Map<number, string>();
  for (const t of proTeams) abbrevOf.set(Number(t.id), String(t.abbrev ?? NHL_ABBREV[Number(t.id)] ?? `T${t.id}`).toUpperCase());

  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const t0 = new Date(`${todayET}T00:00:00Z`).getTime();
  // Scoring day N is `current` today, so any other day's date follows from the difference.
  const dateOf = (i: number) => new Date(t0 + (periods[i] - (status.current as number)) * 86400000);

  const rows: GridTeam[] = proTeams.map((t) => {
    const id = Number(t.id);
    const cells: GridCell[] = [];
    for (let i = 0; i < span; i++) {
      const games = t.proGamesByScoringPeriod?.[String(periods[i])];
      const g = Array.isArray(games) && games.length > 0 ? games[0] : null;
      if (!g) {
        cells.push({ game: false });
        continue;
      }
      const home = Number(g.homeProTeamId);
      const away = Number(g.awayProTeamId);
      const isAway = away === id;
      const oppId = isAway ? home : home === id ? away : NaN;
      cells.push({ game: true, opp: abbrevOf.get(oppId), away: Number.isFinite(away) && away > 0 ? isAway : undefined });
    }
    return { abbrev: abbrevOf.get(id) as string, cells, gp: 0, off: 0, score: 0 };
  });

  const days: GridDay[] = [];
  for (let i = 0; i < span; i++) {
    const games = Math.round(rows.filter((r) => r.cells[i].game).length / 2);
    days.push({
      label: dateOf(i).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
      games,
      light: games <= LIGHT_DAY_GAMES,
    });
  }
  for (const r of rows) {
    r.gp = r.cells.filter((c) => c.game).length;
    r.off = r.cells.filter((c, i) => c.game && days[i].light).length;
  }
  const avgGp = rows.reduce((n, r) => n + r.gp, 0) / rows.length;
  const avgOff = rows.reduce((n, r) => n + r.off, 0) / rows.length;
  // Interim schedule rating: games above the league average count most, off-night games count half as much.
  for (const r of rows) r.score = Math.round(((r.gp - avgGp) + 0.5 * (r.off - avgOff)) * 100) / 100;

  // My team's open slots per day.
  const teamOptions = (await getStandings().catch(() => null))?.teams.map((t) => ({ id: t.id, name: t.name })) ?? [];
  const mine = teamId && teamOptions.some((t) => t.id === teamId) ? await getOpenSlots(teamId, periods).catch(() => null) : null;
  const canFill = (pos: string, o: OpenSlots) =>
    pos === "G" ? o.G > 0 : pos === "D" ? o.D > 0 || o.UTIL > 0 : pos === "C" ? o.C > 0 || o.F > 0 || o.UTIL > 0 : pos === "LW" ? o.LW > 0 || o.F > 0 || o.UTIL > 0 : o.RW > 0 || o.F > 0 || o.UTIL > 0;
  const cellsOf = new Map(rows.map((r) => [r.abbrev, r.cells] as const));

  // Free agents on each team, for the "who can I pick up from this team" panel.
  const avail = await getBestAvailable().catch(() => null);
  const players: GridPlayer[] = (avail?.players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team: p.team,
    status: p.status,
    owned: p.owned,
    injury: p.injury,
    gp: p.w.season?.gp ?? 0,
    pts: p.w.season?.pts ?? 0,
    avg: p.w.season?.avg ?? 0,
    vor: p.w.season?.vor ?? null,
    fits: mine ? (cellsOf.get(p.team) ?? []).map((c, i) => (c.game && canFill(p.position, mine.open[i]) ? i : -1)).filter((i) => i >= 0) : [],
  }));

  const first = dateOf(0).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = dateOf(span - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { days, teams: rows, players, week: wk, maxWeek, from: first, to: last, teamId: mine ? (teamId as number) : 0, teamName: mine?.teamName ?? "", teamOptions, open: mine?.open ?? null };
}
