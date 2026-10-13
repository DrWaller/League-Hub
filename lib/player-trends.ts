// Server-side only. League-wide (owned or not) season stats for the "who changed" player awards: Breakout,
// Bounce Back and Most Improved. Each season's most-owned players are saved to Postgres once (past seasons never
// change; the current one is refreshed a few times a day), so a page load doesn't re-read ESPN.

import { sql } from "./db";
import { getPlayerPool } from "./espn";
import { getImportedSeason } from "./imported-seasons";
import { skaterTierCutoffs, rosterableBar, tierNameOf, type TierCuts } from "./past-awards";
import type { Group } from "./radar";

const POS: Record<number, string> = { 1: "C", 2: "LW", 3: "RW", 4: "D", 5: "G" };
const REFRESH_CURRENT_MS = 6 * 3600 * 1000;

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS pool_season_stats (
      season INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      gp INTEGER NOT NULL,
      points REAL NOT NULL,
      PRIMARY KEY (season, player_id)
    );
  `;
  await sql`CREATE TABLE IF NOT EXISTS pool_season_meta (season INTEGER PRIMARY KEY, fetched_at TIMESTAMPTZ NOT NULL);`;
}

export interface PoolRow {
  season: number;
  id: number;
  name: string;
  position: string;
  gp: number;
  points: number;
}

async function loadSeason(season: number): Promise<PoolRow[]> {
  const r = await sql`SELECT season, player_id, name, position, gp, points FROM pool_season_stats WHERE season = ${season};`;
  return r.rows.map((x) => ({ season: Number(x.season), id: Number(x.player_id), name: String(x.name), position: String(x.position), gp: Number(x.gp), points: Number(x.points) }));
}

async function saveSeason(season: number, currentSeason: number): Promise<boolean> {
  // A season played on Fantrax was imported with the league's own scoring, so it is used instead of ESPN (which has
  // no player stats for it). Its ids are the NHL's, saved as negatives and matched to ESPN ids by name when loaded.
  const imp = await getImportedSeason(season).catch(() => null);
  let rows: { player_id: number; name: string; position: string; gp: number; points: number }[];
  if (imp && imp.players.length > 0) {
    rows = imp.players.map((p, i) => ({ player_id: -(p.nhlId ?? 1_000_000_000 + i), name: p.name, position: POS[p.positionId] ?? "?", gp: p.gp, points: p.appliedTotal }));
  } else {
    const groups: Group[] = ["F", "D", "G"];
    const pools = await Promise.all(groups.map((g) => getPlayerPool(g, season === currentSeason ? undefined : season)));
    rows = pools.flat().map((p) => ({ player_id: p.id, name: p.name, position: POS[p.positionId] ?? "?", gp: p.gp, points: p.appliedTotal }));
  }
  if (rows.length === 0) return false; // ESPN gave nothing: don't record this season as fetched
  const json = JSON.stringify(rows);
  await sql`DELETE FROM pool_season_stats WHERE season = ${season};`;
  await sql`
    INSERT INTO pool_season_stats (season, player_id, name, position, gp, points)
    SELECT ${season}, r.player_id, r.name, r.position, r.gp, r.points
    FROM json_to_recordset(${json}::json) AS r(player_id integer, name text, position text, gp integer, points real)
    ON CONFLICT (season, player_id) DO NOTHING;
  `;
  await sql`
    INSERT INTO pool_season_meta (season, fetched_at) VALUES (${season}, now())
    ON CONFLICT (season) DO UPDATE SET fetched_at = now();
  `;
  return true;
}

// Brings the current season and the three before it up to date, at most `limit` seasons per call.
export async function syncPoolStats(currentSeason: number, limit = 2): Promise<{ saved: number; waiting: number }> {
  await ensureTables();
  const meta = await sql`SELECT season, fetched_at FROM pool_season_meta;`;
  const fetchedAt = new Map(meta.rows.map((m) => [Number(m.season), new Date(m.fetched_at as string).getTime()]));
  const wanted = [currentSeason, currentSeason - 1, currentSeason - 2, currentSeason - 3];
  const stale = wanted.filter((s) => {
    const at = fetchedAt.get(s);
    return at === undefined || (s === currentSeason && Date.now() - at > REFRESH_CURRENT_MS);
  });
  let saved = 0;
  for (const s of stale.slice(0, limit)) {
    if (await saveSeason(s, currentSeason).catch(() => false)) saved++;
  }
  return { saved, waiting: Math.max(0, stale.length - limit) };
}

// Past-season rebuilds: makes sure the given seasons are saved, at most `limit` per call (each is three ESPN reads).
// Seasons ESPN has nothing for are reported back so the page can say so.
export async function syncPoolSeasons(seasons: number[], currentSeason: number, limit = 1): Promise<{ saved: number; waiting: number; empty: number[] }> {
  await ensureTables();
  const have = await sql`SELECT DISTINCT season FROM pool_season_stats;`;
  const haveSet = new Set(have.rows.map((x) => Number(x.season)));
  const missing = seasons.filter((s) => !haveSet.has(s));
  let saved = 0;
  const empty: number[] = [];
  for (const s of missing.slice(0, limit)) {
    if (await saveSeason(s, currentSeason).catch(() => false)) saved++;
    else empty.push(s);
  }
  return { saved, waiting: Math.max(0, missing.length - limit), empty };
}

export async function loadPoolStats(currentSeason: number): Promise<PoolRow[]> {
  await ensureTables();
  const r = await sql`
    SELECT season, player_id, name, position, gp, points FROM pool_season_stats WHERE season >= ${currentSeason - 3} AND season <= ${currentSeason};
  `;
  const rows = r.rows.map((x) => ({ season: Number(x.season), id: Number(x.player_id), name: String(x.name), position: String(x.position), gp: Number(x.gp), points: Number(x.points) }));
  return matchImportedIds(rows);
}

const nameKey = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// Imported (Fantrax) seasons carry NHL ids saved as negatives. So the same player lines up across seasons, give each one
// the ESPN id of the same name (and goalie/skater group) found in any ESPN season.
export function matchImportedIds(rows: PoolRow[]): PoolRow[] {
  if (!rows.some((x) => x.id < 0)) return rows;
  const grp = (pos: string) => (pos === "G" ? "G" : "S");
  const espn = new Map<string, number>();
  for (const x of rows) if (x.id > 0) espn.set(`${nameKey(x.name)}|${grp(x.position)}`, x.id);
  return rows.map((x) => (x.id < 0 ? { ...x, id: espn.get(`${nameKey(x.name)}|${grp(x.position)}`) ?? x.id } : x));
}

// ---------------------------------------------------------------------------------------------------------
// The awards. All rules live here so they are easy to change.

export const ELITE_SKATERS = 30; // elite = top 30 skaters in points per game (top 8 goalies): what "was already elite" means
export const NEAR_ELITE = 0.05; // Breakout: reaching Elite, or coming within this many points per game of it, counts
export const BREAKOUT_ENTRY = 40; // a Breakout skater only has to reach the top 40 this season (a 2-spot miss at 32nd should not rule out a +1.0 jump)
export const ELITE_GOALIES = 8;
export const DOWN_SEASON_DROP = 0.15; // Bounce Back: last season's points per game fell at least this much
export const BOUNCE_RECOVERY = 0.9; // ...and this season he is back to at least this share of the earlier level
const MIN_PREV_GP = { S: 20, G: 15 }; // a past season only counts with this many games (starts for goalies)

type G = "S" | "G";
const groupOf = (position: string): G => (position === "G" ? "G" : "S");

interface Line {
  id: number;
  name: string;
  position: string;
  gp: number;
  points: number;
  ppg: number;
}

export interface TrendEntry {
  id: number;
  name: string;
  position: string;
  rank: number;
  value: string; // headline number
  detail: string; // what it was compared with
}

export interface TrendAward {
  key: "breakout" | "bounce" | "improved" | "calder";
  title: string;
  blurb: string;
  entries: TrendEntry[];
  why?: string; // Breakout only: where a named player (the recorded winner) stands under these rules, and why
}

const sd = (xs: number[]) => {
  if (xs.length < 2) return 1;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
};

const f2 = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${f2(n)}`;

// `bar` = points per game at each position that counts as rosterable (replacement level). A player below it is never
// an award candidate, however big his jump: a 0.4 to 0.9 points-per-game climb is not a story.
export interface LeagueShape {
  counts: Record<number, number> | null; // the league's lineup slots
  teamCount: number;
}

export function buildTrendAwards(rows: PoolRow[], currentSeason: number, top = 5, league: LeagueShape | null = null, probeName?: string): TrendAward[] {
  // The league's tiers, rebuilt for each season from its own totals. Without them (slots unknown) the older top-N
  // rules are used.
  const tierCache = new Map<number, Record<"F" | "D", TierCuts> | null>();
  const tiersFor = (season: number) => {
    if (!tierCache.has(season)) tierCache.set(season, league ? skaterTierCutoffs(rows, season, league.counts, league.teamCount) : null);
    return tierCache.get(season) ?? null;
  };
  const bar = league ? rosterableBar(rows, currentSeason, league.counts, league.teamCount) : null; // replacement level (used for goalies)
  const fd = (position: string): "F" | "D" => (position === "D" ? "D" : "F");
  const curTiers = tiersFor(currentSeason);
  const eliteIn = (season: number, l: { position: string; ppg: number } | undefined) => {
    const t = tiersFor(season);
    return !!l && !!t && l.ppg >= t[fd(l.position)].elite;
  };
  const lines = (season: number): Map<number, Line> => {
    const m = new Map<number, Line>();
    for (const r of rows) {
      if (r.season !== season || r.gp <= 0) continue;
      m.set(r.id, { id: r.id, name: r.name, position: r.position, gp: r.gp, points: r.points, ppg: r.points / r.gp });
    }
    return m;
  };
  const cur = lines(currentSeason);
  const prev = [1, 2, 3].map((k) => lines(currentSeason - k)); // prev[0] = last season

  // This season only has a few games so far, so "enough games" scales with the most any player has played.
  const maxGp = (g: G) => Math.max(0, ...[...cur.values()].filter((l) => groupOf(l.position) === g).map((l) => l.gp));
  const minCur = { S: Math.max(3, Math.round(maxGp("S") * 0.4)), G: Math.max(2, Math.round(maxGp("G") * 0.4)) };

  const qualifies = (l: Line | undefined, isCurrent: boolean): l is Line => {
    if (!l) return false;
    const g = groupOf(l.position);
    return l.gp >= (isCurrent ? minCur[g] : MIN_PREV_GP[g]);
  };

  // Elite = in the top N of his group for points per game, among players with enough games that season.
  const eliteSet = (m: Map<number, Line>, isCurrent: boolean, skaters = ELITE_SKATERS): Set<number> => {
    const out = new Set<number>();
    (["S", "G"] as const).forEach((g) => {
      const pool = [...m.values()].filter((l) => groupOf(l.position) === g && qualifies(l, isCurrent)).sort((a, b) => b.ppg - a.ppg);
      pool.slice(0, g === "S" ? skaters : ELITE_GOALIES).forEach((l) => out.add(l.id));
    });
    return out;
  };
  // Rosterable = Depth tier or better (skaters), or at least replacement level (goalies).
  const rosterable = (l: Line) => (l.position !== "G" && curTiers ? l.ppg >= curTiers[fd(l.position)].depth : !bar || l.ppg >= (bar[l.position] ?? 0));
  const eliteNow = eliteSet(cur, true, BREAKOUT_ENTRY);
  const isEliteNow = (l: Line) => (curTiers ? l.ppg >= curTiers[fd(l.position)].elite - NEAR_ELITE : eliteNow.has(l.id));
  const wasElite = (l: Line) => (curTiers ? prev.some((m, i) => qualifies(m.get(l.id), false) && eliteIn(currentSeason - 1 - i, m.get(l.id))) : elitePrev.some((x) => x.has(l.id)));
  const elitePrev = prev.map((m) => eliteSet(m, false));

  // Spread of points per game (and of season points) in each group, so a goalie's swing and a skater's swing
  // are measured on the same scale when they are ranked against each other.
  const spread = (g: G, pick: (l: Line) => number) => sd([...cur.values()].filter((l) => groupOf(l.position) === g && qualifies(l, true)).map(pick));
  const sdPpg = { S: spread("S", (l) => l.ppg), G: spread("G", (l) => l.ppg) };
  const sdPts = { S: spread("S", (l) => l.points), G: spread("G", (l) => l.points) };

  const entries = (list: { l: Line; score: number; value: string; detail: string }[]): TrendEntry[] =>
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((x, i) => ({ id: x.l.id, name: x.l.name, position: x.l.position, rank: i + 1, value: x.value, detail: x.detail }));

  // Breakout: elite now, never elite in the last three seasons. He needs at least one earlier season on record
  // (a player with none is a rookie and belongs to the Calder).
  const breakout = [...cur.values()]
    .filter((l) => groupOf(l.position) === "S" && qualifies(l, true) && rosterable(l) && isEliteNow(l))
    .map((l) => {
      const history = prev.map((m) => m.get(l.id)).filter((p): p is Line => qualifies(p, false));
      if (history.length === 0) return null;
      if (wasElite(l)) return null;
      const best = Math.max(...history.map((p) => p.ppg));
      const g = groupOf(l.position);
      return { l, score: (l.ppg - best) / sdPpg[g], value: `${f2(l.ppg)} pts/gm`, detail: `best before: ${f2(best)}` };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Bounce Back: a clear down season last year, and back near the earlier level now.
  const bounce = [...cur.values()]
    .filter((l) => qualifies(l, true) && rosterable(l))
    .map((l) => {
      const last = prev[0].get(l.id);
      const before = prev[1].get(l.id);
      if (!qualifies(last, false) || !qualifies(before, false)) return null;
      if (last.ppg > before.ppg * (1 - DOWN_SEASON_DROP)) return null;
      if (l.ppg < before.ppg * BOUNCE_RECOVERY) return null;
      const g = groupOf(l.position);
      return { l, score: (l.ppg - last.ppg) / sdPpg[g], value: `${signed(l.ppg - last.ppg)} pts/gm`, detail: `${f2(l.ppg)} now, ${f2(last.ppg)} last year, ${f2(before.ppg)} the year before` };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Most Improved: the biggest gain on last season, judged two ways and combined: the change in points per game,
  // and the change in total points (this season's points against what last season's pace would have given in the
  // same games, so a part-season is fair). A player's combined score is the average of his two ranks.
  const improvedBase = [...cur.values()]
    .filter((l) => qualifies(l, true) && rosterable(l))
    .map((l) => {
      const last = prev[0].get(l.id);
      if (!qualifies(last, false)) return null;
      const g = groupOf(l.position);
      const dPpg = l.ppg - last.ppg;
      const dTot = l.points - last.ppg * l.gp;
      return { l, last, dPpg, dTot, nPpg: dPpg / sdPpg[g], nTot: dTot / sdPts[g] };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.dPpg > 0);
  const rankBy = (key: "nPpg" | "nTot") => {
    const order = [...improvedBase].sort((a, b) => b[key] - a[key]);
    return new Map(order.map((x, i) => [x.l.id, i + 1]));
  };
  const rPpg = rankBy("nPpg");
  const rTot = rankBy("nTot");
  const improved = improvedBase.map((x) => {
    const avg = ((rPpg.get(x.l.id) ?? 0) + (rTot.get(x.l.id) ?? 0)) / 2;
    return {
      l: x.l,
      score: -avg + x.nPpg * 0.001, // lowest average rank first; per-game gain breaks ties
      value: `${signed(x.dPpg)} pts/gm`,
      detail: `${f2(x.l.ppg)} vs ${f2(x.last.ppg)} last year, ${signed(x.dTot)} total pts`,
    };
  });


  // Calder: the NHL's own rookie rules, checked against the last three seasons on record. A player is a rookie if he
  // never played more than 25 games in a past season and did not play 6 or more games in each of two past seasons.
  // (The age limit, under 26 by Sept 15, is not checked: ESPN does not give birth dates here.) Best rookie by
  // fantasy points so far, the same measure as the Art Ross.
  const calder = [...cur.values()]
    .filter(rosterable)
    .filter((l) => {
      const past = prev.map((m) => m.get(l.id)?.gp ?? 0);
      return past.every((gp) => gp <= 25) && past.filter((gp) => gp >= 6).length < 2;
    })
    .map((l) => ({ l, score: l.points + l.ppg * 0.001, value: `${f2(l.points)} pts`, detail: `${l.gp} GP, ${f2(l.ppg)} pts/gm` }));

  // Where a named player stands for the Breakout, step by step, so a recorded winner the rules miss can be understood.
  let why: string | undefined;
  if (probeName) {
    const k = nameKey(probeName);
    const l = [...cur.values()].find((x) => nameKey(x.name) === k);
    const rankOf = (m: Map<number, Line>, id: number, isCurrent: boolean) => {
      const list = [...m.values()].filter((x) => groupOf(x.position) === "S" && qualifies(x, isCurrent)).sort((a, b) => b.ppg - a.ppg);
      const i = list.findIndex((x) => x.id === id);
      return i < 0 ? null : i + 1;
    };
    if (!l) why = `${probeName} is not in the ${currentSeason} stats.`;
    else {
      const parts: string[] = [`${f2(l.ppg)} pts/gm in ${l.gp} GP`];
      if (groupOf(l.position) === "G") parts.push("a goalie, so not eligible");
      else if (curTiers) {
        const c = curTiers[fd(l.position)];
        parts.push(`${tierNameOf(l.ppg, c)} tier (${fd(l.position) === "D" ? "defence" : "forwards"}: Depth ${f2(c.depth)}, Elite ${f2(c.elite)}, Superstar ${f2(c.superstar)})`);
      } else {
        const r = rankOf(cur, l.id, true);
        parts.push(r ? `#${r} among skaters (needs top ${BREAKOUT_ENTRY})` : "not enough games to rank");
      }
      const before = prev.map((m, i) => {
        const p = m.get(l.id);
        const t = tiersFor(currentSeason - 1 - i);
        return `${currentSeason - 1 - i}: ${p ? `${f2(p.ppg)}${t ? ` ${tierNameOf(p.ppg, t[fd(p.position)])}` : ""}` : "no stats"}`;
      });
      parts.push(`before: ${before.join("; ")}`);
      const hit = breakout.find((x) => x.l.id === l.id);
      if (hit) parts.push(`ranks #${[...breakout].sort((a, b) => b.score - a.score).findIndex((x) => x.l.id === l.id) + 1} of ${breakout.length}`);
      else if (groupOf(l.position) === "G") parts.push("left out: goalies are not in the Breakout");
      else if (!rosterable(l)) parts.push("left out: below the rosterable bar (Depth tier)");
      else if (!isEliteNow(l)) parts.push("left out: not within 0.05 of the Elite cutoff this season");
      else if (wasElite(l)) parts.push("left out: already Elite in an earlier season");
      else if (!prev.some((m) => qualifies(m.get(l.id), false))) parts.push("left out: no earlier qualifying season");
      why = parts.join(" · ");
    }
  }

  return [
    { key: "breakout", title: "Breakout Player", blurb: `Finalists for the biggest jump into the Elite tier or better (by points per game, with separate forward and defence cutoffs; coming within 0.05 of Elite counts) for the first time: not Elite in any of the last three seasons. A breakout should be a player who stays elite, so age and the earlier seasons are shown. Skaters only: goalies are recognised by the Vezina and Jennings. Players with no earlier season are left to the Calder. Rosterable players only (Depth tier or better).`, entries: entries(breakout), why },
    { key: "bounce", title: "Bounce Back Player", blurb: `Last year's points per game fell ${DOWN_SEASON_DROP * 100}% or more, and he is back to ${BOUNCE_RECOVERY * 100}% of the earlier level. Ranked by the rebound. Rosterable players only.`, entries: entries(bounce) },
    { key: "improved", title: "Most Improved Player", blurb: "Biggest gain on last season, combining the change in points per game and the change in total points. Rosterable players only (Depth tier or better).", entries: entries(improved) },
    { key: "calder", title: "Calder Trophy", blurb: "Best rookie by fantasy points, owned or not, using the NHL rookie rules (no more than 25 games in any past season, and not 6+ games in each of two past seasons). Rosterable rookies only.", entries: entries(calder) },
  ];
}
