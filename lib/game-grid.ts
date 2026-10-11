// Server-side only. The NHL game grid: every NHL team by day, which nights are light (8 or fewer games
// league-wide, Frozen Pool's rule), each team's games and off-night games, and the free agents on each team.

import { getLeagueMeta } from "@/lib/espn";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { getBestAvailable, NHL_ABBREV } from "@/lib/best-available";

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
}
export interface GridData {
  days: GridDay[];
  teams: GridTeam[];
  players: GridPlayer[];
  span: number;
  shift: number;
  from: string;
  to: string;
}

export async function getGameGrid(span: number, shift: number): Promise<GridData | null> {
  const meta = await getLeagueMeta();
  const season = meta.season;
  const status = await getCurrentScoringPeriod();
  if (status.current === null) return null;

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
  const dateOf = (i: number) => new Date(t0 + (shift + i) * 86400000);

  const rows: GridTeam[] = proTeams.map((t) => {
    const id = Number(t.id);
    const cells: GridCell[] = [];
    for (let i = 0; i < span; i++) {
      const games = t.proGamesByScoringPeriod?.[String((status.current as number) + shift + i)];
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
  }));

  const first = dateOf(0).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = dateOf(span - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { days, teams: rows, players, span, shift, from: first, to: last };
}
