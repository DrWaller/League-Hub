// Server-side only. How the NHL actually uses each skater: ice time, power-play time and an inferred line.
//
// Source: the NHL's public stats API (api.nhle.com), which has per-player time on ice, even-strength
// time and power-play time. It does NOT publish lines, so lines are inferred from ice time:
//   forwards, ranked by even-strength TOI per game on their team: top 3 = L1, next 3 = L2, ... (L4 last)
//   defence, ranked the same way: top 2 = pair 1, next 2 = pair 2, ...
//   power play: the 5 skaters with the most PP time on a team = PP1, the next 5 = PP2
// Each player gets a 0-100 role score (ice time, power-play share and line), see roleScore().

import { ESPN_TO_NHL as TEAM_MAP, norm as normName, type LineIndex } from "@/lib/lines";
import { describeChange, type LineChange } from "@/lib/lines-store";

const SEASON_ID = (season: number) => `${season - 1}${season}`; // 2027 -> 20262027
const RECENT_DAYS = 14;

const ESPN_TO_NHL = TEAM_MAP;

export interface Usage {
  nhlId: number; // the NHL's player id
  toiSeason: number; // seconds per game
  toiRecent: number | null; // seconds per game over the last two weeks
  toi: number; // blended, what the score uses
  ppShare: number; // share of his team's power-play time (0-1)
  ppShareRecent: number | null;
  line: string | null; // "L1".."L4" for forwards, "D1".."D3" for defence
  pp: "PP1" | "PP2" | null;
  pk: string | null;
  source: "lines" | "inferred"; // real line combinations, or inferred from ice time
  change: { text: string; at: string } | null; // a recent line / PP change
  score: number; // 0-100
  mult: number; // multiplier applied to expected points per game
}

type Row = { id: number; name: string; team: string; pos: string; gp: number; toi: number; ev: number; pp: number; ppTotal: number };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fetchRows(season: number, since: string | null): Promise<Row[] | null> {
  const exp = `gameTypeId=2 and seasonId=${SEASON_ID(season)}${since ? ` and gameDate>="${since}"` : ""}`;
  const url = `https://api.nhle.com/stats/rest/en/skater/timeonice?limit=-1&cayenneExp=${encodeURIComponent(exp)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return ((data?.data ?? []) as any[])
      .filter((r) => Number(r.gamesPlayed) > 0)
      .map((r) => ({
        id: Number(r.playerId),
        name: String(r.skaterFullName ?? ""),
        team: String(r.teamAbbrevs ?? "").split(",").pop()!.trim(), // traded players: the latest team
        pos: String(r.positionCode ?? ""),
        gp: Number(r.gamesPlayed),
        toi: Number(r.timeOnIcePerGame) || 0,
        ev: Number(r.evTimeOnIcePerGame) || 0,
        pp: Number(r.ppTimeOnIcePerGame) || 0,
        ppTotal: Number(r.ppTimeOnIce) || 0,
      }));
  } catch {
    return null;
  }
}

function percentile(value: number, all: number[]): number {
  if (all.length === 0) return 0;
  let below = 0;
  for (const v of all) if (v < value) below++;
  return (below / all.length) * 100;
}

export interface UsageIndex {
  lookup(name: string, espnTeam?: string, position?: string): Usage | null;
}

export async function getNhlUsage(season: number, lines: LineIndex | null = null, changes: LineChange[] = []): Promise<UsageIndex | null> {
  const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const [seasonRows, recentRows] = await Promise.all([fetchRows(season, null), fetchRows(season, since)]);
  if (!seasonRows || seasonRows.length === 0) return null;
  const recent = new Map<number, Row>((recentRows ?? []).map((r) => [r.id, r] as const));

  // Team power-play time: skaters' PP time adds up to five times the team's, so divide by five.
  const ppTeamTotal = (rows: Row[]) => {
    const t = new Map<string, number>();
    for (const r of rows) t.set(r.team, (t.get(r.team) ?? 0) + r.ppTotal);
    return t;
  };
  const teamPP = ppTeamTotal(seasonRows);
  const teamPPRecent = ppTeamTotal(recentRows ?? []);

  const isD = (p: string) => p === "D";
  const byTeam = new Map<string, Row[]>();
  for (const r of seasonRows) byTeam.set(r.team, [...(byTeam.get(r.team) ?? []), r]);

  // Line and PP unit from recent usage when there is enough of it, else the season's.
  const lineOf = new Map<number, string>();
  const ppOf = new Map<number, "PP1" | "PP2">();
  for (const rows of Array.from(byTeam.values())) {
    const use = (r: Row) => {
      const rr = recent.get(r.id);
      return rr && rr.gp >= 2 ? rr : r;
    };
    const fwd = rows.filter((r) => !isD(r.pos)).sort((a, b) => use(b).ev - use(a).ev);
    fwd.forEach((r, i) => lineOf.set(r.id, `L${Math.min(4, Math.floor(i / 3) + 1)}`));
    const def = rows.filter((r) => isD(r.pos)).sort((a, b) => use(b).ev - use(a).ev);
    def.forEach((r, i) => lineOf.set(r.id, `D${Math.min(3, Math.floor(i / 2) + 1)}`));
    const ppRank = [...rows].sort((a, b) => use(b).ppTotal - use(a).ppTotal);
    ppRank.forEach((r, i) => {
      const share = (teamPPRecent.get(r.team) && recent.get(r.id) ? use(r).ppTotal / (teamPPRecent.get(r.team)! / 5) : r.ppTotal / ((teamPP.get(r.team) ?? 1) / 5)) || 0;
      if (i < 5 && share >= 0.08) ppOf.set(r.id, "PP1");
      else if (i < 10 && share >= 0.08) ppOf.set(r.id, "PP2");
    });
  }

  const usage = new Map<number, Usage>();
  const parts = new Map<number, { toiPct: number; ppPct: number; team: string }>();
  const toiVals = { F: [] as number[], D: [] as number[] };
  const ppVals: number[] = [];
  const pre = seasonRows.map((r) => {
    const rr = recent.get(r.id);
    const toiRecent = rr && rr.gp >= 2 ? rr.toi : null;
    const toi = toiRecent !== null ? 0.5 * r.toi + 0.5 * toiRecent : r.toi;
    const ppShare = r.ppTotal / ((teamPP.get(r.team) ?? 0) / 5 || Infinity);
    const ppShareRecent = rr && rr.gp >= 2 && (teamPPRecent.get(r.team) ?? 0) > 0 ? rr.ppTotal / ((teamPPRecent.get(r.team) as number) / 5) : null;
    const ppBlend = ppShareRecent !== null ? 0.5 * ppShare + 0.5 * ppShareRecent : ppShare;
    (isD(r.pos) ? toiVals.D : toiVals.F).push(toi);
    ppVals.push(ppBlend);
    return { r, toiRecent, toi, ppShare, ppShareRecent, ppBlend };
  });
  const LINE_PTS: Record<string, number> = { L1: 100, L2: 70, L3: 40, L4: 15, D1: 100, D2: 55, D3: 20 };
  for (const p of pre) {
    const line = lineOf.get(p.r.id) ?? null;
    const toiPct = percentile(p.toi, isD(p.r.pos) ? toiVals.D : toiVals.F);
    const ppPct = p.ppBlend < 0.04 ? 0 : percentile(p.ppBlend, ppVals);
    const score = Math.round(0.45 * toiPct + 0.3 * ppPct + 0.25 * (line ? LINE_PTS[line] : 20));
    parts.set(p.r.id, { toiPct, ppPct, team: p.r.team });
    usage.set(p.r.id, {
      nhlId: p.r.id,
      toiSeason: p.r.toi,
      toiRecent: p.toiRecent,
      toi: p.toi,
      ppShare: Math.min(1, p.ppShare),
      ppShareRecent: p.ppShareRecent,
      line,
      pp: ppOf.get(p.r.id) ?? null,
      pk: null,
      source: "inferred",
      change: null,
      score,
      mult: Math.round((0.85 + 0.3 * (score / 100)) * 1000) / 1000,
    });
  }

  // Match ESPN players to NHL ids: full name (with team to break ties), then first initial + last name.
  const byName = new Map<string, Row[]>();
  const byInitial = new Map<string, Row[]>();
  for (const r of seasonRows) {
    const n = norm(r.name);
    const parts = n.split(" ");
    const ik = `${parts[0]?.[0] ?? ""} ${parts.slice(1).join(" ")}`;
    byName.set(n, [...(byName.get(n) ?? []), r]);
    byInitial.set(ik, [...(byInitial.get(ik) ?? []), r]);
  }
  // Namesakes on one team (the two Elias Petterssons in Vancouver) are told apart by position: defence vs forward.
  const pick = (rows: Row[] | undefined, team?: string, position?: string) => {
    if (!rows || rows.length === 0) return null;
    if (rows.length === 1) return rows[0];
    const t = team ? ESPN_TO_NHL[team] ?? team : null;
    let pool = t ? rows.filter((r) => r.team === t) : rows;
    if (pool.length > 1 && position) {
      const side = pool.filter((r) => isD(r.pos) === (position === "D"));
      if (side.length > 0) pool = side;
    }
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];
    return t ? pool[0] : null;
  };
  const changeOf = new Map<string, LineChange>();
  for (const c of changes) if (!changeOf.has(`${c.team}|${c.player}`)) changeOf.set(`${c.team}|${c.player}`, c); // newest first
  const LINE_SCORE: Record<string, number> = { L1: 100, L2: 70, L3: 40, L4: 15, D1: 100, D2: 55, D3: 20 };

  return {
    lookup(name: string, espnTeam?: string, position?: string) {
      const n = norm(name);
      const parts2 = n.split(" ");
      const row = pick(byName.get(n), espnTeam, position) ?? pick(byInitial.get(`${parts2[0]?.[0] ?? ""} ${parts2.slice(1).join(" ")}`), espnTeam, position);
      if (!row) return null;
      const base = usage.get(row.id);
      const pt = parts.get(row.id);
      if (!base || !pt) return base ?? null;
      // Real lines win when that team's page was read; a player who isn't listed isn't in the lineup.
      if (!lines || !lines.teamsOk.includes(row.team)) return base;
      const real = lines.lookup(name, row.team, position);
      const line = real?.line ?? null;
      const pp = real?.pp ?? null;
      const score = Math.round(0.4 * pt.toiPct + 0.25 * pt.ppPct + 0.2 * (line ? LINE_SCORE[line] : 10) + 0.15 * (pp === "PP1" ? 100 : pp === "PP2" ? 50 : 0));
      const ch = changeOf.get(`${row.team}|${norm(real?.name ?? name)}`);
      return {
        ...base,
        line,
        pp,
        pk: real?.pk ?? null,
        source: "lines" as const,
        change: ch ? { text: describeChange(ch), at: ch.changedAt } : null,
        score,
        mult: Math.round((0.85 + 0.3 * (score / 100)) * 1000) / 1000,
      };
    },
  };
}
