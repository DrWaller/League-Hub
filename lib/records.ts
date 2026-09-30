// The Records book: all-time totals per manager, best/worst seasons, single-
// game records and head-to-head, built from every past season's teams and
// weekly results. Pure logic (no database/network) so it can be tested.
//
// Regular season only: playoff games are left out of every total (they're
// flagged on each matchup). Championships come from the hand-entered League
// History (champion / runner-up team names), matched to that season's teams.

import { Matchup } from "./types";
import { regularSeasonFinals } from "./luck";

export interface RecTeam {
  id: number;
  name: string;
  managerId: number | null;
}
export interface RecSeason {
  season: number;
  teams: RecTeam[];
  matchups: Matchup[];
  champion: string | null;
  runnerUp: string | null;
}
export interface RecManager {
  id: number;
  name: string;
}

export interface CareerRow {
  managerId: number;
  name: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  titles: number;
  runnerUps: number;
  firstPlace: number; // regular-season first-place finishes
}

export interface SeasonRow {
  managerId: number;
  managerName: string;
  season: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  teamCount: number;
}

export interface GameRecord {
  season: number;
  week: number;
  teamName: string;
  managerName: string | null;
  score: number;
  oppName: string;
  oppScore: number;
  margin: number;
}

export interface H2H {
  w: number;
  l: number;
  t: number;
}

export interface Records {
  careers: CareerRow[];
  seasonRows: SeasonRow[];
  bestSeasons: SeasonRow[];
  worstSeasons: SeasonRow[];
  highScoringSeasons: SeasonRow[];
  highScores: GameRecord[];
  lowScores: GameRecord[];
  biggestWins: GameRecord[];
  closestGames: GameRecord[];
  h2h: Record<number, Record<number, H2H>>;
  h2hOrder: number[]; // manager ids, best all-time win% first
  unlinked: { season: number; team: string }[]; // teams with games but no manager
  unmatchedChampions: { season: number; name: string; role: "champion" | "runner-up" }[];
}

// Lowercase, accents and punctuation stripped, spaces collapsed -- so
// "Evan's Team!" and "evans team" compare equal.
const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// League History champions are typed by hand, so they may be a team name OR
// a manager's name, and may not match exactly. Tries, in order: exact team
// name, exact manager name, then partial matches either way. A tier only
// counts when it points to exactly one team, so an ambiguous name is
// reported as unmatched instead of guessed.
function findEntryTeam(entry: string, teams: RecTeam[], managerName: (t: RecTeam) => string): RecTeam | undefined {
  const n = norm(entry);
  if (!n) return undefined;
  const tiers: ((t: RecTeam) => boolean)[] = [
    (t) => norm(t.name) === n,
    (t) => t.managerId != null && norm(managerName(t)) === n,
    (t) => {
      const tn = norm(t.name);
      return tn.length >= 3 && (tn.includes(n) || n.includes(tn));
    },
    (t) => {
      if (t.managerId == null) return false;
      const mn = norm(managerName(t));
      return mn.length >= 3 && (` ${n} `.includes(` ${mn} `) || ` ${mn} `.includes(` ${n} `));
    },
  ];
  for (const pred of tiers) {
    const hits = teams.filter(pred);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined;
  }
  return undefined;
}
const winPct = (w: number, l: number, t: number) => (w + l + t > 0 ? (w + t * 0.5) / (w + l + t) : 0);
const TOP = 5;

export function buildRecords(managers: RecManager[], seasons: RecSeason[]): Records {
  const nameOf = new Map(managers.map((m) => [m.id, m.name]));
  const careers = new Map<number, CareerRow>();
  const career = (id: number) => {
    if (!careers.has(id))
      careers.set(id, { managerId: id, name: nameOf.get(id) ?? `Manager ${id}`, seasons: 0, wins: 0, losses: 0, ties: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, titles: 0, runnerUps: 0, firstPlace: 0 });
    return careers.get(id)!;
  };

  const seasonRows: SeasonRow[] = [];
  const games: GameRecord[] = [];
  const h2h: Record<number, Record<number, H2H>> = {};
  const unlinked: Records["unlinked"] = [];
  const unmatchedChampions: Records["unmatchedChampions"] = [];
  const bump = (a: number, b: number, key: keyof H2H) => {
    (h2h[a] ??= {})[b] ??= { w: 0, l: 0, t: 0 };
    h2h[a][b][key]++;
  };

  for (const s of seasons) {
    const finals = regularSeasonFinals(s.matchups);
    const teamById = new Map(s.teams.map((t) => [t.id, t]));
    const stats = new Map<number, { w: number; l: number; t: number; pf: number; pa: number }>();
    const stat = (id: number) => {
      if (!stats.has(id)) stats.set(id, { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
      return stats.get(id)!;
    };

    for (const m of finals) {
      const h = stat(m.homeTeamId);
      const a = stat(m.awayTeamId);
      h.pf += m.homeScore;
      h.pa += m.awayScore;
      a.pf += m.awayScore;
      a.pa += m.homeScore;
      if (m.homeScore > m.awayScore) {
        h.w++;
        a.l++;
      } else if (m.awayScore > m.homeScore) {
        a.w++;
        h.l++;
      } else {
        h.t++;
        a.t++;
      }

      const home = teamById.get(m.homeTeamId);
      const away = teamById.get(m.awayTeamId);
      const nm = (t?: RecTeam) => (t?.managerId ? nameOf.get(t.managerId) ?? null : null);
      const rec = (mine: RecTeam | undefined, myScore: number, theirs: RecTeam | undefined, theirScore: number): GameRecord => ({
        season: s.season,
        week: m.week,
        teamName: mine?.name ?? "Unknown team",
        managerName: nm(mine),
        score: myScore,
        oppName: theirs?.name ?? "Unknown team",
        oppScore: theirScore,
        margin: myScore - theirScore,
      });
      games.push(rec(home, m.homeScore, away, m.awayScore), rec(away, m.awayScore, home, m.homeScore));

      // head-to-head: only when both sides are linked to (different) managers
      const hm = home?.managerId ?? null;
      const am = away?.managerId ?? null;
      if (hm && am && hm !== am) {
        if (m.homeScore > m.awayScore) {
          bump(hm, am, "w");
          bump(am, hm, "l");
        } else if (m.awayScore > m.homeScore) {
          bump(am, hm, "w");
          bump(hm, am, "l");
        } else {
          bump(hm, am, "t");
          bump(am, hm, "t");
        }
      }
    }

    // season ranking among teams that played
    const ranked = Array.from(stats.entries())
      .map(([id, x]) => ({ id, ...x, pct: winPct(x.w, x.l, x.t) }))
      .sort((p, q) => q.pct - p.pct || q.pf - p.pf);
    const rankOf = new Map(ranked.map((r, i) => [r.id, i + 1]));

    const managerName = (t: RecTeam) => (t.managerId ? nameOf.get(t.managerId) ?? "" : "");
    const champTeam = s.champion ? findEntryTeam(s.champion, s.teams, managerName) : undefined;
    const runnerTeam = s.runnerUp ? findEntryTeam(s.runnerUp, s.teams, managerName) : undefined;
    if (s.champion && !champTeam?.managerId) unmatchedChampions.push({ season: s.season, name: s.champion, role: "champion" });
    if (s.runnerUp && !runnerTeam?.managerId) unmatchedChampions.push({ season: s.season, name: s.runnerUp, role: "runner-up" });

    for (const r of ranked) {
      const team = teamById.get(r.id);
      if (!team?.managerId) {
        unlinked.push({ season: s.season, team: team?.name ?? `Team ${r.id}` });
        continue;
      }
      const c = career(team.managerId);
      c.seasons++;
      c.wins += r.w;
      c.losses += r.l;
      c.ties += r.t;
      c.pointsFor += r.pf;
      c.pointsAgainst += r.pa;
      if (rankOf.get(r.id) === 1) c.firstPlace++;
      seasonRows.push({
        managerId: team.managerId,
        managerName: c.name,
        season: s.season,
        teamName: team.name,
        wins: r.w,
        losses: r.l,
        ties: r.t,
        winPct: r.pct,
        pointsFor: r.pf,
        pointsAgainst: r.pa,
        rank: rankOf.get(r.id)!,
        teamCount: ranked.length,
      });
    }
    if (champTeam?.managerId) career(champTeam.managerId).titles++;
    if (runnerTeam?.managerId) career(runnerTeam.managerId).runnerUps++;
  }

  for (const c of careers.values()) c.winPct = winPct(c.wins, c.losses, c.ties);
  const careerRows = Array.from(careers.values()).sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor);

  const top = <T,>(arr: T[], cmp: (a: T, b: T) => number) => [...arr].sort(cmp).slice(0, TOP);
  return {
    careers: careerRows,
    seasonRows,
    bestSeasons: top(seasonRows, (a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor),
    worstSeasons: top(seasonRows, (a, b) => a.winPct - b.winPct || a.pointsFor - b.pointsFor),
    highScoringSeasons: top(seasonRows, (a, b) => b.pointsFor - a.pointsFor),
    highScores: top(games, (a, b) => b.score - a.score),
    lowScores: top(games, (a, b) => a.score - b.score),
    biggestWins: top(games.filter((g) => g.margin > 0), (a, b) => b.margin - a.margin),
    closestGames: top(games.filter((g) => g.margin > 0), (a, b) => a.margin - b.margin),
    h2h,
    h2hOrder: careerRows.map((c) => c.managerId),
    unlinked,
    unmatchedChampions,
  };
}
