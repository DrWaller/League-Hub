// Server-side only. Past winners worked out from each finished season's saved player stats, for the awards that are
// decided by the numbers (Hart, Art Ross, Norris, Vezina, Forward of the Year). They are kept apart from the winners
// recorded by hand: anything recorded (lib/season-awards.ts) or saved on the admin Past Winners page always wins.

import { sql } from "./db";
import { getLeagueMeta } from "./espn";
import { syncPoolSeasons, loadPoolStats } from "./player-trends";
import { seasonLeaders } from "./past-awards";
import { getSeasonBundle } from "./season-data";
import { getPlayedElsewhereSeasons } from "./content";
import { fetchLineupSlots } from "./vor";

export const FIRST_SEASON = 2020;
// award key -> the leader list it is read from
export const AUTO_AWARDS = ["hart", "artross", "norris", "vezina", "forward"] as const;

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS award_winners_auto (season INTEGER NOT NULL, award TEXT NOT NULL, winner TEXT NOT NULL, detail TEXT, PRIMARY KEY (season, award));`;
}

export async function loadAutoWinners(): Promise<Map<string, { name: string; detail: string }>> {
  await ensureTable();
  const r = await sql`SELECT season, award, winner, detail FROM award_winners_auto;`;
  return new Map(r.rows.map((x) => [`${x.season}|${x.award}`, { name: String(x.winner), detail: String(x.detail ?? "") }]));
}

// Seasons (newest first) that still have no automatic winners saved, or every season when `all` is set.
export async function seasonsToGenerate(currentSeason: number, all = false): Promise<number[]> {
  await ensureTable();
  const have = new Set((await sql`SELECT DISTINCT season FROM award_winners_auto;`).rows.map((x) => Number(x.season)));
  const out: number[] = [];
  for (let s = currentSeason - 1; s >= FIRST_SEASON; s--) if (all || !have.has(s)) out.push(s);
  return out;
}

// Loads one season's player stats if needed (a few ESPN reads), then saves the leader of each automatic award.
export async function generateSeasonWinners(season: number): Promise<{ season: number; saved: Record<string, string>; note?: string }> {
  await ensureTable();
  const meta = await getLeagueMeta();
  const sync = await syncPoolSeasons([season], meta.season, 1);
  if (sync.empty.includes(season)) return { season, saved: {}, note: "No player stats could be loaded for this season." };
  const rows = await loadPoolStats(season);
  if (!rows.some((r) => r.season === season)) return { season, saved: {}, note: "No player stats saved for this season." };

  // Same settings the Past Season Awards page uses: a Fantrax season has no ESPN lineup settings, so it borrows the current ones.
  const [bundle, elsewhere, seasonSlots, currentSlots] = await Promise.all([
    getSeasonBundle(season).catch(() => null),
    getPlayedElsewhereSeasons().catch(() => new Set<number>()),
    fetchLineupSlots(season).catch(() => null),
    fetchLineupSlots(meta.season).catch(() => null),
  ]);
  const counts = elsewhere.has(season) ? currentSlots : seasonSlots ?? currentSlots;
  const leaders = seasonLeaders(rows, season, counts, bundle?.teams?.length ?? meta.size, 1);

  const saved: Record<string, string> = {};
  for (const award of AUTO_AWARDS) {
    const top = leaders[award]?.[0];
    if (!top) continue;
    const detail = `${top.value}${top.detail ? `, ${top.detail}` : ""}`;
    await sql`INSERT INTO award_winners_auto (season, award, winner, detail) VALUES (${season}, ${award}, ${top.name}, ${detail}) ON CONFLICT (season, award) DO UPDATE SET winner = ${top.name}, detail = ${detail};`;
    saved[award] = top.name;
  }
  return { season, saved, note: counts ? undefined : "Lineup settings were not available, so the VOR awards could not be worked out." };
}
