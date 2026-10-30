// Server-side only (reads ESPN_S2 / ESPN_SWID). Never import from a Client Component.
//
// Player comparison: up to four players side by side, whoever owns them (or nobody). Each player gets the same
// numbers the Best Available page uses (points, games, average and VOR for the season and the last 7 / 15 / 30 days,
// every scoring stat, game nights) plus his league tier, position rank and form from the tier directory.

import { unstable_cache } from "next/cache";
import { getLeagueMeta, getScoringItems } from "@/lib/espn";
import { STAT_META } from "@/lib/espn-stats";
import { getCurrentScoringPeriod } from "@/lib/espn-daily";
import { getReplacementRates } from "@/lib/vor";
import { getTierDirectory } from "@/lib/team-makeup";
import type { Tier } from "@/lib/tier-style";
import {
  DAYS_AHEAD,
  NHL_ABBREV,
  POS_BY_ID,
  WINDOW_PREFIX,
  base,
  cookies,
  fetchProTeams,
  rank,
  windowStat,
  type AvailablePlayer,
  type StatCat,
  type Window,
} from "@/lib/best-available";

export const MAX_COMPARE = 4;

// One row of the picker: every rated player in the league, rostered or not.
export interface DirectoryEntry {
  id: number;
  name: string;
  pos: string;
  nhl: string;
  owner: string | null;
  tier: Tier | null;
  est: number | null;
  status: "Rostered" | "Free agent" | "Waivers";
  form: Tier | null;
  trend: "up" | "down" | null;
  priorAvg: number | null;
}

export interface ComparePlayer extends Omit<AvailablePlayer, "status"> {
  owner: string | null; // fantasy team, or null for a free agent / waivers
  rosterStatus: "Rostered" | "Free agent" | "Waivers";
  est: number | null; // the tier rating (goalies: points per team game)
  posRank: number | null; // 1 = best-rated at his exact position, owned or not
  posCount: number;
  form: Tier | null; // tier of his last 30 days
  trend: "up" | "down" | null;
  priorAvg: number | null; // last season's average (20+ games)
}

export interface CompareData {
  season: number;
  scheduleKnown: boolean;
  days: { offset: number; date: string; label: string }[];
  cats: StatCat[];
  players: ComparePlayer[]; // in the order asked for
}

const loadDirectory = unstable_cache(
  async (): Promise<DirectoryEntry[]> => {
    const dir = await getTierDirectory();
    return (dir?.players ?? []).map((p) => ({ id: p.id, name: p.name, pos: p.pos, nhl: p.nhl, owner: p.owner, tier: p.tier, est: p.est, status: p.status, form: p.form, trend: p.trend, priorAvg: p.priorAvg }));
  },
  ["compare-directory-v2"],
  { revalidate: 600 }
);

export async function getCompareDirectory(): Promise<DirectoryEntry[]> {
  try {
    return await loadDirectory();
  } catch (e) {
    console.error("compare directory failed", e);
    return [];
  }
}

// Players by id, with the stat windows. One ESPN call for all of them.
async function fetchPlayers(season: number, ids: number[], notes: string[]): Promise<any[]> {
  const stat = (Object.values(WINDOW_PREFIX) as string[]).map((p) => `${p}${season}`);
  const shape = (withStats: boolean) => ({
    players: {
      filterIds: { value: ids },
      ...(withStats ? { filterStatsForTopScoringPeriodIds: { value: 5, additionalValue: stat } } : {}),
      limit: ids.length,
    },
  });
  for (const withStats of [true, false]) {
    try {
      const res = await fetch(`${base(season)}?view=kona_player_info`, {
        headers: { ...cookies(), "x-fantasy-filter": JSON.stringify(shape(withStats)) },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        notes.push(`ESPN ${res.status} (stats ${withStats ? "on" : "off"}): ${(await res.text()).slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data?.players) && data.players.length > 0) return data.players;
      notes.push(`ESPN returned no players (stats ${withStats ? "on" : "off"}; keys: ${Object.keys(data ?? {}).join(",")})`);
    } catch (err) {
      notes.push(`fetch error (stats ${withStats ? "on" : "off"}): ${String(err).slice(0, 120)}`);
    }
  }
  return [];
}

export async function getCompare(ids: number[]): Promise<CompareData | null> {
  const want = Array.from(new Set(ids)).slice(0, MAX_COMPARE);
  if (want.length === 0 || !process.env.ESPN_S2 || !process.env.ESPN_SWID) return null;
  const meta = await getLeagueMeta();
  const season = meta.season;
  const notes: string[] = [];

  const [raw, pro, status, rates, items, dir] = await Promise.all([
    fetchPlayers(season, want, notes),
    fetchProTeams(season),
    getCurrentScoringPeriod(),
    getReplacementRates(season, meta.currentWeek).catch(() => null),
    getScoringItems().catch(() => []),
    getCompareDirectory(),
  ]);
  if (raw.length === 0) {
    console.error("Compare: no players loaded", notes);
    throw new Error(notes.join(" | ") || "no players returned");
  }

  const current = status.current;
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days: CompareData["days"] = [];
  if (current !== null) {
    const t0 = new Date(`${todayET}T00:00:00Z`).getTime();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(t0 + i * 86400000);
      days.push({ offset: i, date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) });
    }
  }
  const scheduleKnown = pro !== null && current !== null;

  const cats: StatCat[] = [];
  for (const it of items) {
    const id = String(it.statId);
    if (!it.points || id === "34" || cats.some((c) => c.id === id)) continue;
    const m = STAT_META[id];
    cats.push({ id, label: m?.label ?? `Stat ${id}`, goalie: Boolean(m?.goalie), rate: Boolean(m?.rate), higherIsBetter: it.points > 0 });
  }
  cats.sort((a, b) => rank(a.id) - rank(b.id));
  const catIds = cats.map((c) => c.id);

  // Position rank among every rated player at the same exact position.
  const byId = new Map(dir.map((p) => [p.id, p] as const));
  const posRank = (id: number, pos: string): { rank: number | null; count: number } => {
    const mine = byId.get(id);
    if (!mine || mine.est === null) return { rank: null, count: 0 };
    const same = dir.filter((p) => p.pos === pos && p.est !== null);
    return { rank: same.filter((p) => (p.est as number) > (mine.est as number)).length + 1, count: same.length };
  };

  const out = new Map<number, ComparePlayer>();
  for (const e of raw) {
    const pl = e?.player ?? e?.playerPoolEntry?.player;
    const pos = POS_BY_ID[pl?.defaultPositionId];
    if (!pl || pl.id == null || !pos) continue;
    const stats: any[] = pl.stats ?? [];
    const w = {} as Record<Window, ReturnType<typeof windowStat>>;
    for (const k of Object.keys(WINDOW_PREFIX) as Window[]) w[k] = windowStat(stats, WINDOW_PREFIX[k], season, pos, rates, catIds);
    const proId = Number(pl.proTeamId);
    const games: number[] = [];
    if (scheduleKnown) {
      const sched = pro!.get(proId)?.days;
      if (sched) for (let i = 0; i < DAYS_AHEAD; i++) if (sched.has((current as number) + i)) games.push(i);
    }
    const projEntry = stats.find((x) => x.statSourceId === 1 && x.statSplitTypeId === 0 && !x.scoringPeriodId);
    const projGp = Number(projEntry?.stats?.["34"]) || Number(projEntry?.stats?.["0"]) || 0;
    const projTotal = Number(projEntry?.appliedTotal);
    const inj = String(pl.injuryStatus ?? "ACTIVE");
    const owned = Number(pl.ownership?.percentOwned);
    const d = byId.get(Number(pl.id));
    const pr = posRank(Number(pl.id), pos);
    out.set(Number(pl.id), {
      id: Number(pl.id),
      name: pl.fullName ?? "Unknown Player",
      position: pos,
      team: pro?.get(proId)?.abbrev ?? NHL_ABBREV[proId] ?? "FA",
      owned: Number.isFinite(owned) ? owned : null,
      injury: inj === "ACTIVE" ? null : inj.replace(/_/g, " ").toLowerCase(),
      proj: projEntry && projGp > 0 && Number.isFinite(projTotal) ? projTotal / projGp : null,
      games,
      w,
      tier: d?.tier ?? null,
      owner: d?.owner ?? null,
      rosterStatus: d?.status ?? "Free agent",
      est: d?.est ?? null,
      posRank: pr.rank,
      posCount: pr.count,
      form: d?.form ?? null,
      trend: d?.trend ?? null,
      priorAvg: d?.priorAvg ?? null,
    });
  }
  const players = want.map((id) => out.get(id)).filter((p): p is ComparePlayer => Boolean(p));
  return { season, scheduleKnown, days, cats, players };
}
